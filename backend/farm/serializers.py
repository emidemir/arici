from rest_framework import serializers

from .models import Farm, FarmImages

class FarmImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = FarmImages
        fields = ['image']

class FarmSerializer(serializers.ModelSerializer):
    images = FarmImageSerializer(many=True)
    class Meta:
        model = Farm
        fields = ['id', 'user', 'description', 'acres', 'region', 'city', 'district', 'crop', 'location', 'images']