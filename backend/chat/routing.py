# chat/routing.py

from django.urls import re_path
from .consumer import ChatConsumer

# Scope: ws/chat/<conversation_id>/
# conversation_id is an integer PK — \d+ is intentional (not \w+).
websocket_urlpatterns = [
    re_path(r'^ws/chat/(?P<conversation_id>\d+)/$', ChatConsumer.as_asgi()),
]