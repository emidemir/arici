from rest_framework import serializers

from django.contrib.gis.geos import Point

from .models import Farm, FarmImages

class FarmImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = FarmImages
        fields = ['id', 'image']

class FarmSerializer(serializers.ModelSerializer):
    images = FarmImageSerializer(many=True, read_only=True)
    
    # 1. Redefine location as a CharField so DRF accepts the raw string from React
    location = serializers.CharField(required=True)

    class Meta:
        model = Farm
        fields = ['id', 'user', 'description', 'acres', 'region', 'city', 'district', 'crop', 'location', 'images']

    # 2. Convert "lat,lng" string from React into a GeoDjango Point object
    def validate_location(self, value):
        if not value:
            raise serializers.ValidationError("Location is required.")
        try:
            lat_str, lng_str = value.split(',')
            
            # GEOSGeometry Point takes (X, Y) -> (Longitude, Latitude)
            # SRID 4326 sets the coordinate system to standard WGS84 (GPS standard)
            return Point(float(lng_str), float(lat_str), srid=4326)
            
        except (ValueError, TypeError):
            raise serializers.ValidationError("Invalid location format. Expected 'lat,lng'.")

    # 3. Convert the Point object back to a "lat,lng" string when sending data to React
    def to_representation(self, instance):
        representation = super().to_representation(instance)
        
        # instance.location is a Point object where y=lat and x=lng
        if instance.location:
            representation['location'] = f"{instance.location.y},{instance.location.x}"
            
        return representation