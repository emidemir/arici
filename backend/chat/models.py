# chat/models.py

from django.db import models
from django.conf import settings


class Conversation(models.Model):
    """
    A direct conversation between exactly two users,
    optionally anchored to a specific Farm listing.

    The "room name" used by the WebSocket consumer is simply str(self.pk),
    so the channel group becomes  chat_<id>.
    """
    participant_1 = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='conversations_as_p1',
    )
    participant_2 = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='conversations_as_p2',
    )

    # Optional — a beekeeper contacts a farmer about a specific listing.
    farm = models.ForeignKey(
        'farm.Farm',           # adjust to your actual app_label.ModelName
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='conversations',
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)   # bumped on every new message

    class Meta:
        ordering = ['-updated_at']
        # Enforce that a pair of users can only have ONE conversation per farm
        # (or one farm-less conversation).  The triple is unique together.
        constraints = [
            models.UniqueConstraint(
                fields=['participant_1', 'participant_2', 'farm'],
                name='unique_conversation_per_farm',
            )
        ]

    # ── Helpers ──────────────────────────────────────────────────────────────

    def get_other_participant(self, user):
        """Return the participant that is NOT the given user."""
        return self.participant_2 if self.participant_1_id == user.pk else self.participant_1

    def has_participant(self, user):
        return user.pk in (self.participant_1_id, self.participant_2_id)

    @classmethod
    def get_or_create_for_users(cls, user_a, user_b, farm=None):
        """
        Canonical factory — always stores the lower PK as participant_1
        so we never create duplicate (A↔B) and (B↔A) rows.
        """
        p1, p2 = (user_a, user_b) if user_a.pk < user_b.pk else (user_b, user_a)
        conversation, created = cls.objects.get_or_create(
            participant_1=p1,
            participant_2=p2,
            farm=farm,
        )
        return conversation, created

    def __str__(self):
        farm_str = f' re: Farm#{self.farm_id}' if self.farm_id else ''
        return f'Conversation#{self.pk} [{self.participant_1} ↔ {self.participant_2}]{farm_str}'


class Message(models.Model):
    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name='messages',
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sent_messages',
    )

    body = models.TextField()

    # Read receipt — set to True when the other participant has seen it.
    is_read = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f'Message#{self.pk} by {self.sender} in Conversation#{self.conversation_id}'