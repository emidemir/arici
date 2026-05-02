from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver
from django.core.cache import cache

from farm.models import Farm

@receiver([post_save, post_delete], sender=Farm)
def cache_invalidation(sender, instance, **kwargs):
    # https://github.com/jazzband/django-redis#scan--delete-keys-in-bulk
    # .delete_pattern('...') doesn't exist in the original django redis code. You must use (pip install django-redis)
    # package in order to use this method
    cache.delete_pattern('*land_list*')