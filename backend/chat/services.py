# chat/services.py
import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from notifications.models import Notification

logger = logging.getLogger(__name__)


def broadcast_new_message(message, temp_id=None):
    """
    Push a newly-created Message out to everyone connected to its
    conversation's WebSocket room, and create/bump the recipient's
    notification.

    Message creation has two call sites: ChatConsumer.handle_chat_message
    (an existing, already-open conversation, over the WebSocket) and
    ConversationListCreateView.post (starting a brand new conversation,
    over REST — that's the only way a conversation is created at all).
    Only the WebSocket path used to do either of these things, so a
    conversation's very first message never reached a connected recipient
    in real time and never created a notification — every later message
    in the same conversation worked fine once both sides had the
    WebSocket open, which made this look like an intermittent bug rather
    than "the first message specifically, always." Centralizing this
    logic means a third call site can't quietly reintroduce the same gap.
    """
    conversation = message.conversation
    sender = message.sender
    room_group_name = f'chat_{conversation.pk}'

    payload = {
        'type':            'chat.message',
        'id':              str(message.pk),
        'temp_id':         temp_id,
        'conversation_id': conversation.pk,
        'sender_id':       str(sender.pk),
        'sender_name':     getattr(sender, 'full_name', sender.username),
        'body':            message.body,
        'is_read':         False,
        'created_at':      message.created_at.isoformat(),
    }

    try:
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(room_group_name, payload)
    except Exception:
        # A recipient simply not being connected right now is normal and
        # shouldn't block message creation — but a genuine channel-layer
        # failure (Redis down, etc.) should be visible, not silent.
        logger.exception(
            "Failed to broadcast new message %s to %s", message.pk, room_group_name
        )

    recipient = conversation.get_other_participant(sender)
    existing = Notification.objects.filter(
        recipient=recipient,
        type='message',
        conversation=conversation,
        is_read=False,
    ).first()

    if existing:
        existing.message_count += 1
        existing.actor_name     = getattr(sender, 'full_name', sender.username)
        existing.verb           = 'sent you a message'
        existing.created_at     = message.created_at
        existing.save(update_fields=['message_count', 'actor_name', 'verb', 'created_at'])
    else:
        Notification.objects.create(
            recipient=recipient,
            actor=sender,
            actor_name=getattr(sender, 'full_name', sender.username),
            verb='sent you a message',
            type='message',
            conversation=conversation,
        )
