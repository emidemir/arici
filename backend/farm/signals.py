import logging

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver
from django.core.cache import cache

from farm.models import Farm

logger = logging.getLogger(__name__)


@receiver([post_save, post_delete], sender=Farm)
def cache_invalidation(sender, instance, **kwargs):
    # https://github.com/jazzband/django-redis#scan--delete-keys-in-bulk
    # .delete_pattern('...') doesn't exist in the original django redis code. You must use (pip install django-redis)
    # package in order to use this method
    #
    # This pattern used to be '*land_list*', which doesn't match anything:
    # FarmClusterView caches its results under keys like
    # "clusters_z6_39.1_..." (see farm/views.py), and FarmsList isn't cached
    # at all (its @cache_page decorator is commented out). So every time a
    # Farm was created, edited, or deleted, this ran, deleted zero keys, and
    # nobody noticed — the map just kept serving stale clusters for up to an
    # hour with no error of any kind, because there was no error to raise.
    deleted = cache.delete_pattern('*clusters_z*')
    action = 'created' if kwargs.get('created') else 'updated' if 'created' in kwargs else 'deleted'
    logger.info(
        "Farm %s %s — invalidated %s cached cluster key(s)",
        instance.pk, action, deleted,
    )