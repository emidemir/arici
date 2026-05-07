# chat/serializers.py

from rest_framework import serializers
from .models import Conversation, Message


# ── Minimal user representation ───────────────────────────────────────────────
# We only need a few fields; importing your full user serializer here would
# likely cause circular imports.  Add / remove fields to match your User model.

class ParticipantSerializer(serializers.Serializer):
    id         = serializers.UUIDField()
    username   = serializers.CharField()
    full_name  = serializers.CharField()        # your custom field
    email      = serializers.EmailField()
    avatar     = serializers.ImageField(use_url=True, allow_null=True, required=False)
    is_online  = serializers.BooleanField(default=False)   # populated by the view


# ── Farm summary (enough for the chat header / context card) ─────────────────

class FarmSummarySerializer(serializers.Serializer):
    id       = serializers.UUIDField()
    district = serializers.CharField()
    city     = serializers.CharField()
    region   = serializers.CharField()
    crop     = serializers.CharField()


# ── Message ───────────────────────────────────────────────────────────────────

class MessageSerializer(serializers.ModelSerializer):
    sender_id   = serializers.UUIDField(source='sender.id',        read_only=True)
    sender_name = serializers.CharField(source='sender.full_name',    read_only=True)
    is_mine     = serializers.SerializerMethodField()

    class Meta:
        model  = Message
        fields = [
            'id', 'conversation', 'sender_id', 'sender_name',
            'body', 'is_read', 'is_mine', 'created_at',
        ]
        read_only_fields = [
            'id', 'conversation', 'sender_id', 'sender_name',
            'is_read', 'is_mine', 'created_at',
        ]

    def get_is_mine(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.sender_id == request.user.pk
        return False


class MessageCreateSerializer(serializers.ModelSerializer):
    """Used only for POST /conversations/<id>/messages/ — body only."""
    class Meta:
        model  = Message
        fields = ['body']


# ── Conversation ──────────────────────────────────────────────────────────────

class ConversationSerializer(serializers.ModelSerializer):
    other_participant = serializers.SerializerMethodField()
    last_message      = serializers.SerializerMethodField()
    unread_count      = serializers.SerializerMethodField()
    farm              = serializers.SerializerMethodField()

    class Meta:
        model  = Conversation
        fields = [
            'id', 'other_participant', 'last_message',
            'unread_count', 'farm', 'created_at', 'updated_at',
        ]

    def _user(self):
        return self.context['request'].user

    def get_other_participant(self, obj):
        other = obj.get_other_participant(self._user())
        return {
            'id':        other.pk,
            'username':  other.username,
            'full_name': getattr(other, 'full_name', other.username),
            'email':     other.email,
            'avatar':    None,   # swap for other.avatar.url if you have it
            'is_online': False,  # implement presence separately if needed
        }

    def get_last_message(self, obj):
        msg = obj.messages.last()
        if msg is None:
            return None
        return {
            'id':         msg.pk,
            'body':       msg.body,
            'created_at': msg.created_at.isoformat(),
            'is_mine':    msg.sender_id == self._user().pk,
        }

    def get_unread_count(self, obj):
        return obj.messages.filter(is_read=False).exclude(sender=self._user()).count()

    def get_farm(self, obj):
        if obj.farm_id is None:
            return None
        return {
            'id':       obj.farm.pk,
            'district': obj.farm.district,
            'city':     obj.farm.city,
            'region':   obj.farm.region,
            'crop':     obj.farm.crop,
        }


class ConversationCreateSerializer(serializers.Serializer):
    recipient_id = serializers.UUIDField()
    farm_id      = serializers.UUIDField(required=False, allow_null=True) 
    body         = serializers.CharField(required=False, allow_blank=True, default='')