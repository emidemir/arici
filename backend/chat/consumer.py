# chat/consumer.py

import json
import logging

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

from notifications.models import Notification
from .models import Conversation, Message

User = get_user_model()
logger = logging.getLogger(__name__)


class TokenAuthConsumerMixin:
    """
    Shared JWT-from-query-string authentication for WebSocket consumers.

    Browsers can't set Authorization headers on WebSocket connections, so
    the frontend passes the JWT as ?token=<jwt> in the connection URL
    instead. Used by both ChatConsumer (per-conversation rooms) and
    UserNotifyConsumer (the per-user "you have new activity" channel) —
    extracted here so the two don't drift out of sync with each other.
    """

    @database_sync_to_async
    def _authenticate_from_query_string(self):
        try:
            query_string = self.scope.get('query_string', b'').decode()
            params = dict(
                pair.split('=', 1)
                for pair in query_string.split('&')
                if '=' in pair
            )
            raw_token = params.get('token', '')
            if not raw_token:
                return None

            validated = AccessToken(raw_token)
            user_id = validated['user_id']
            return User.objects.get(pk=user_id)
        except (InvalidToken, TokenError, User.DoesNotExist) as e:
            # Expected/routine: missing, expired, or malformed token, or a
            # token for a user that no longer exists. Not worth more than a
            # debug line — this happens constantly for logged-out visitors.
            logger.debug("WebSocket auth rejected: %s", e)
            return None
        except Exception:
            # Anything else (a bad query string, a DB hiccup, ...) is *not*
            # a routine auth failure — it's a bug or an infra problem, and
            # silently treating it the same as "bad token" made it
            # indistinguishable from a visitor just not being logged in.
            # Log it with a traceback so it's actually findable, but still
            # decline the connection rather than crashing the consumer.
            logger.exception("Unexpected error authenticating WebSocket connection")
            return None


class ChatConsumer(TokenAuthConsumerMixin, AsyncJsonWebsocketConsumer):
    """
    WebSocket consumer for real-time chat *within a single conversation*.

    Connection URL: ws/chat/<conversation_id>/

    The client must be authenticated (session or token).
    On connect we verify the user is a participant; if not we close immediately.

    Message types sent TO the client:
        { "type": "chat.message",  ...message fields... }
        { "type": "chat.read",     "conversation_id": int, "reader_id": int }
        { "type": "chat.error",    "message": str }

    Message types received FROM the client:
        { "type": "chat.message",  "body": str, "temp_id": str }
        { "type": "chat.read" }          ← user has opened the conversation

    The sender includes a "temp_id" (a client-generated string like "temp-1234")
    which is echoed back in the broadcast payload.  The sender's onmessage handler
    uses it to swap the optimistic bubble for the real DB-persisted message,
    avoiding duplicates.  Other participants receive temp_id too but ignore it.

    IMPORTANT LIMITATION this consumer cannot solve on its own: this room
    (chat_<conversation_id>) only has listeners once someone has actually
    opened *this specific* conversation at least once. A brand new
    conversation's first message has nobody to broadcast to on the
    recipient's side, no matter what — they have no way to be "already
    connected" to a room for a conversation that didn't exist a moment
    ago. That's what UserNotifyConsumer below exists to solve instead.
    """

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    async def connect(self):
        self.user = await self._authenticate_from_query_string()

        if self.user is None:
            await self.close(code=4001)
            return

        self.conversation_id = self.scope['url_route']['kwargs']['conversation_id']
        self.room_group_name = f'chat_{self.conversation_id}'

        # Verify the user is actually a participant
        conversation = await self.get_conversation()
        if conversation is None:
            await self.close(code=4004)
            return

        self.conversation = conversation

        # Join the Redis channel group
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    # ── Receive from client ───────────────────────────────────────────────────

    async def receive_json(self, content):
        msg_type = content.get('type')

        if msg_type == 'chat.message':
            await self.handle_chat_message(content)

        elif msg_type == 'chat.read':
            await self.handle_read_receipt()

        else:
            await self.send_json({'type': 'chat.error', 'message': f'Unknown type: {msg_type}'})

    # ── Handlers ──────────────────────────────────────────────────────────────

    async def handle_chat_message(self, content):
        body = (content.get('body') or '').strip()
        if not body:
            await self.send_json({'type': 'chat.error', 'message': 'Empty message body.'})
            return

        # Persist to DB
        message = await self.save_message(body)

        # Build the broadcast payload once — everyone in the group gets the same dict.
        # temp_id is echoed back so the sender can match the optimistic bubble.
        payload = {
            'type':            'chat.message',
            'id':              str(message.pk),
            'temp_id':         content.get('temp_id'),   # ← echoed back to sender
            'conversation_id': self.conversation_id,
            'sender_id':       str(self.user.pk),
            'sender_name':     getattr(self.user, 'full_name', self.user.username),
            'body':            message.body,
            'is_read':         False,
            'created_at':      message.created_at.isoformat(),
        }

        # Broadcast to everyone already in this conversation's room (including the sender)
        await self.channel_layer.group_send(self.room_group_name, payload)

        # ALSO ping the recipient's personal channel — this is what makes the
        # unread badge / conversation list update instantly even when the
        # recipient isn't currently looking at this specific conversation
        # (elsewhere in the app, or hasn't opened this chat in this session
        # yet). Previously nothing did this: the per-conversation room
        # broadcast above only reaches someone already inside this exact
        # room, so a recipient anywhere else in the app only found out on
        # their next ~20-30s poll.
        await self.notify_recipient()

        # Bump conversation.updated_at so it floats to the top in the sidebar
        await self.touch_conversation()

        await self.create_notification(message)

    async def handle_read_receipt(self):
        """
        Mark all messages sent by the OTHER participant as read.
        Broadcast a read event so the other side can update its tick icons.
        """
        count = await self.mark_messages_read()
        if count > 0:
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type':            'chat.read',
                    'conversation_id': self.conversation_id,
                    'reader_id':       str(self.user.pk),
                }
            )

    # ── Group message handlers (called by channel layer) ──────────────────────
    # The method name must match the "type" field with dots replaced by underscores.

    async def chat_message(self, event):
        """Forward a new message to this WebSocket client."""
        await self.send_json(event)

    async def chat_read(self, event):
        """Forward a read receipt to this WebSocket client."""
        await self.send_json(event)

    # ── Database helpers (run in a thread pool via database_sync_to_async) ────

    @database_sync_to_async
    def create_notification(self, message):
        from notifications.models import Notification
        recipient = self.conversation.get_other_participant(self.user)

        existing = Notification.objects.filter(
            recipient=recipient,
            type='message',
            conversation=self.conversation,
            is_read=False,          # only merge into unread ones
        ).first()

        if existing:
            # bump count and refresh timestamp so it floats to the top
            existing.message_count += 1
            existing.actor_name     = getattr(self.user, 'full_name', self.user.username)
            existing.verb           = 'sent you a message'
            existing.created_at     = message.created_at   # need auto_now_add=False for this
            existing.save(update_fields=['message_count', 'actor_name', 'verb'])
        else:
            Notification.objects.create(
                recipient=recipient,
                actor=self.user,
                actor_name=getattr(self.user, 'full_name', self.user.username),
                verb='sent you a message',
                type='message',
                conversation=self.conversation,
            )

    async def notify_recipient(self):
        recipient_id = await self.get_recipient_id()
        await self.channel_layer.group_send(
            f'user_{recipient_id}',
            {
                'type': 'notify.event',
                'payload': {
                    'type': 'chat.new_message',
                    'conversation_id': self.conversation_id,
                },
            },
        )

    @database_sync_to_async
    def get_recipient_id(self):
        return self.conversation.get_other_participant(self.user).pk

    @database_sync_to_async
    def get_conversation(self):
        """
        Return the Conversation if it exists AND the user is a participant.
        Returns None otherwise.
        """
        try:
            conversation = Conversation.objects.select_related(
                'participant_1', 'participant_2', 'farm'
            ).get(pk=self.conversation_id)
            if not conversation.has_participant(self.user):
                return None
            return conversation
        except Conversation.DoesNotExist:
            return None

    @database_sync_to_async
    def save_message(self, body):
        return Message.objects.create(
            conversation=self.conversation,
            sender=self.user,
            body=body,
        )

    @database_sync_to_async
    def mark_messages_read(self):
        return (
            Message.objects
            .filter(conversation=self.conversation, is_read=False)
            .exclude(sender=self.user)
            .update(is_read=True)
        )

    @database_sync_to_async
    def touch_conversation(self):
        self.conversation.save(update_fields=['updated_at'])


class UserNotifyConsumer(TokenAuthConsumerMixin, AsyncJsonWebsocketConsumer):
    """
    A single, always-on, per-USER (not per-conversation) WebSocket.

    Connection URL: ws/notify/

    This exists specifically to solve the gap ChatConsumer's per-conversation
    rooms structurally cannot: notifying someone about a conversation they
    aren't currently inside — most importantly, a conversation that didn't
    exist until this exact message created it, which a per-conversation room
    can never have a pre-existing listener for.

    The frontend opens exactly one of these as soon as the user is logged
    in (see lib/notifySocket.js), independent of whatever page they're on,
    and keeps it open for the life of the session — mirroring how a "you've
    got mail" indicator works in basically every real chat product. On
    receiving a chat.new_message event, the frontend force-refreshes the
    unread badge counts and, if the conversation list happens to be on
    screen, that too — instead of waiting up to ~20-30s for the next poll.

    Message types sent TO the client:
        { "type": "chat.new_message", "conversation_id": int }

    Nothing is expected FROM the client on this connection; it's push-only.
    """

    async def connect(self):
        self.user = await self._authenticate_from_query_string()
        if self.user is None:
            await self.close(code=4001)
            return

        self.group_name = f'user_{self.user.pk}'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def notify_event(self, event):
        """Forward a personal notification to this client."""
        await self.send_json(event['payload'])
