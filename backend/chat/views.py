from django.contrib.auth import get_user_model
from django.db.models import Q
from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Conversation, Message
from .serializers import (
    ConversationSerializer,
    ConversationCreateSerializer,
    MessageSerializer,
    MessageCreateSerializer,
)

User = get_user_model()


# ── Pagination ────────────────────────────────────────────────────────────────

class MessagePagination(PageNumberPagination):
    """
    Messages are fetched newest-first from the API, then the frontend
    reverses them for display (oldest at top, like every chat app).
    """
    page_size            = 40
    page_size_query_param = 'page_size'
    max_page_size        = 100


# ── Helpers ───────────────────────────────────────────────────────────────────

def get_conversation_for_user(conversation_id, user):
    """Return the conversation or raise 404/403."""
    conversation = get_object_or_404(Conversation, pk=conversation_id)
    if not conversation.has_participant(user):
        raise PermissionDenied('You are not a participant of this conversation.')
    return conversation


# ── Views ─────────────────────────────────────────────────────────────────────

class ConversationListCreateView(APIView):
    """
    GET  /chats/conversations/        → list all conversations for the current user
    POST /chats/conversations/        → start a new conversation (+ first message)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        conversations = (
            Conversation.objects
            .filter(Q(participant_1=request.user) | Q(participant_2=request.user))
            .select_related('participant_1', 'participant_2', 'farm')
            .prefetch_related('messages')
            .order_by('-updated_at')
        )
        serializer = ConversationSerializer(conversations, many=True, context={'request': request})
        return Response(serializer.data)

    def post(self, request):
        serializer = ConversationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Resolve recipient
        recipient = get_object_or_404(User, pk=data['recipient_id'])
        if recipient.pk == request.user.pk:
            raise ValidationError('You cannot start a conversation with yourself.')

        # Resolve optional farm
        farm = None
        if data.get('farm_id'):
            from farms.models import Farm   # lazy import to avoid circular deps
            farm = get_object_or_404(Farm, pk=data['farm_id'])

        # Get or create the conversation
        conversation, _ = Conversation.get_or_create_for_users(
            request.user, recipient, farm=farm
        )

        # Create the first message
        message = Message.objects.create(
            conversation=conversation,
            sender=request.user,
            body=data['body'],
        )

        # Bump updated_at so this conversation floats to the top
        conversation.save(update_fields=['updated_at'])

        return Response(
            ConversationSerializer(conversation, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


class ConversationDetailView(APIView):
    """
    GET /chats/conversations/<id>/   → single conversation detail
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, conversation_id):
        conversation = get_conversation_for_user(conversation_id, request.user)
        serializer   = ConversationSerializer(conversation, context={'request': request})
        return Response(serializer.data)


class MessageListCreateView(APIView):
    """
    GET  /chats/conversations/<id>/messages/   → paginated message history
    POST /chats/conversations/<id>/messages/   → send a message via REST
                                                  (WebSocket is preferred for real-time,
                                                   but this is a useful fallback)
    """
    permission_classes = [IsAuthenticated]
    pagination_class   = MessagePagination

    def get(self, request, conversation_id):
        conversation = get_conversation_for_user(conversation_id, request.user)

        # Mark all unread messages from the OTHER person as read
        conversation.messages.filter(
            is_read=False
        ).exclude(
            sender=request.user
        ).update(is_read=True)

        messages  = conversation.messages.select_related('sender').order_by('-created_at')
        paginator = self.pagination_class()
        page      = paginator.paginate_queryset(messages, request)
        serializer = MessageSerializer(page, many=True, context={'request': request})

        # Return in ascending order so the frontend can render top-to-bottom
        data = list(reversed(serializer.data))
        return paginator.get_paginated_response(data)

    def post(self, request, conversation_id):
        conversation = get_conversation_for_user(conversation_id, request.user)

        serializer = MessageCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        message = Message.objects.create(
            conversation=conversation,
            sender=request.user,
            body=serializer.validated_data['body'],
        )
        conversation.save(update_fields=['updated_at'])

        return Response(
            MessageSerializer(message, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


class MarkConversationReadView(APIView):
    """
    POST /chats/conversations/<id>/read/
    Marks all messages in this conversation (from the other user) as read.
    Called when the user opens a conversation.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, conversation_id):
        conversation = get_conversation_for_user(conversation_id, request.user)
        updated = (
            conversation.messages
            .filter(is_read=False)
            .exclude(sender=request.user)
            .update(is_read=True)
        )
        return Response({'marked_read': updated})


class UnreadCountView(APIView):
    """
    GET /chats/unread-count/
    Returns the total number of unread messages across ALL conversations.
    Polled by the Navbar badge every 20s.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        count = (
            Message.objects
            .filter(
                conversation__in=Conversation.objects.filter(
                    Q(participant_1=request.user) | Q(participant_2=request.user)
                ),
                is_read=False,
            )
            .exclude(sender=request.user)
            .count()
        )
        return Response({'count': count})