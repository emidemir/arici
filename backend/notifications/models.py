from django.db import models

# Create your models here.
from django.db import models
from django.conf import settings


class Notification(models.Model):
    TYPE_CHOICES = [
        ('message', 'Message'),
        ('farm',    'Farmland'),
        ('system',  'System'),
    ]

    recipient       = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications',
    )
    actor           = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='triggered_notifications',
    )
    actor_name      = models.CharField(max_length=150, blank=True)  # snapshot — survives user deletion
    verb            = models.CharField(max_length=255)               # e.g. "sent you a message"
    type            = models.CharField(max_length=20, choices=TYPE_CHOICES, default='system')

    # Optional FK targets — only populate the relevant one
    conversation    = models.ForeignKey(
        'chat.Conversation',
        on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='notifications',
    )
    farm            = models.ForeignKey(
        'farm.Farm',
        on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='notifications',
    )

    is_read         = models.BooleanField(default=False)
    created_at      = models.DateTimeField(auto_now_add=True)
    message_count = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Notif → {self.recipient} | {self.verb}'