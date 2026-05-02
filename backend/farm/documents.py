from django_elasticsearch_dsl import Document, fields
from django_elasticsearch_dsl.registries import registry
from .models import Farm

@registry.register_document
class FarmDocument(Document):
    region = fields.KeywordField()
    city = fields.KeywordField()
    district = fields.KeywordField()
    crop = fields.KeywordField()
    
    # 1. Ensure the ID is treated as a Keyword string, not a number, because it's a UUID
    user_id = fields.KeywordField() 
    
    location = fields.GeoPointField()

    # === ADD THIS FIELD ===
    # This will store an array of text strings (the URLs)
    image_urls = fields.ListField(fields.TextField())

    class Index:
        name = 'farms'
        settings = {'number_of_shards': 1, 'number_of_replicas': 0}

    class Django:
        model = Farm
        fields = [
            'id',
            'acres', 
        ]

    def prepare_user_id(self, instance):
        return str(instance.user_id) if instance.user_id else None

    def prepare_location(self, instance):
        if instance.location:
            return {
                'lat': instance.location.y,
                'lon': instance.location.x
            }
        return None

    # === ADD THIS METHOD ===
    # This tells Elasticsearch how to populate the 'image_urls' list field
    def prepare_image_urls(self, instance):
        # instance.images.all() uses your related_name='images'
        # img.image.url uses your model field 'image = models.ImageField(...)'
        return [img.image.url for img in instance.images.all() if img.image]