import uuid

from django.db import models
from django.contrib.gis.db.models import PointField

from user.models import User


# Create your models here.
class Farm(models.Model):
    id = models.UUIDField(default=uuid.uuid4, primary_key=True, editable=False, unique=True)
    description = models.TextField(max_length=500, null=True, blank=True)

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='lands')

    acres = models.IntegerField()
    
    class RegionChoices(models.TextChoices):
        MARMARA = 'MARMARA', 'Marmara'
        KARADENIZ = 'KARADENIZ', 'Karadeniz'
        DOGU_ANADOLU = 'DOGU_ANADOLU', 'Dogu_anadolu'
        IC_ANADOLU = 'IC_ANADOLU', 'Ic_anadolu'
        EGE = 'EGE', 'Ege'
        AKDENIZ = 'AKDENIZ', 'Akdeniz'
        GUNEY_DOGU_ANADOLU = 'GUNEY_DOGU_ANADOLU', 'Guney_dogu_anadolu'


    region = models.CharField(max_length=18, choices=RegionChoices.choices)
    city = models.CharField()
    district = models.CharField()

    crop = models.CharField()

    location = PointField(geography=True)

    class Meta:
        indexes = [
            models.Index(fields=['acres', 'region', 'city', 'district', 'crop', 'location'])
        ]

def farmland_image_path(instance, file):
    return '/'.join([f'{str(instance.farm.id)}/',file]) 

class FarmImages(models.Model):
    farm = models.ForeignKey(Farm, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to=farmland_image_path)