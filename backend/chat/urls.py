# chat/urls.py

from django.urls import path
from . import views

# Mount under /chats/ in your root urls.py:
#   path('chats/', include('chat.urls')),

urlpatterns = [
    # Conversation list + create
    path(
        'conversations/',
        views.ConversationListCreateView.as_view(),
        name='conversation-list-create',
    ),

    # Single conversation detail
    path(
        'conversations/<int:conversation_id>/',
        views.ConversationDetailView.as_view(),
        name='conversation-detail',
    ),

    # Message history + send via REST
    path(
        'conversations/<int:conversation_id>/messages/',
        views.MessageListCreateView.as_view(),
        name='message-list-create',
    ),

    # Mark all messages in a conversation as read
    path(
        'conversations/<int:conversation_id>/read/',
        views.MarkConversationReadView.as_view(),
        name='conversation-mark-read',
    ),

    # Total unread count — polled by Navbar badge
    path(
        'unread-count/',
        views.UnreadCountView.as_view(),
        name='unread-count',
    ),
]