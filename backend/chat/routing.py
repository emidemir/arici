# chat/routing.py

from django.urls import re_path
from .consumer import ChatConsumer, UserNotifyConsumer

# Scope: ws/chat/<conversation_id>/
# conversation_id is an integer PK — \d+ is intentional (not \w+).
websocket_urlpatterns = [
    re_path(r'^ws/chat/(?P<conversation_id>\d+)/$', ChatConsumer.as_asgi()),
    # Per-user channel — one per logged-in session, independent of which
    # conversation (if any) is currently open. See UserNotifyConsumer's
    # docstring for why this exists alongside the per-conversation rooms.
    re_path(r'^ws/notify/$', UserNotifyConsumer.as_asgi()),
]