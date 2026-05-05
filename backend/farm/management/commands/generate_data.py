import random
from django.core.management.base import BaseCommand
from django.contrib.gis.geos import Point

# Adjust 'farm' and 'user' to your actual app names
from farm.models import Farm 
from user.models import User

# 1. Structured hierarchy linking Regions -> Cities -> Districts + Bounding Boxes
# Bounding box format: (min_longitude, min_latitude, max_longitude, max_latitude)
TURKEY_GEO_DATA = {
    'MARMARA': {
        'Bursa': {'districts': ['Karacabey', 'Mustafakemalpaşa', 'İnegöl', 'Yenişehir'], 'bbox': (28.3, 39.7, 29.8, 40.6)},
        'Tekirdağ': {'districts': ['Çorlu', 'Süleymanpaşa', 'Hayrabolu', 'Malkara'], 'bbox': (26.9, 40.6, 28.0, 41.4)},
    },
    'EGE': {
        'İzmir': {'districts': ['Ödemiş', 'Tire', 'Bergama', 'Menemen'], 'bbox': (26.3, 38.0, 28.0, 39.2)},
        'Aydın': {'districts': ['Söke', 'Nazilli', 'Efeler', 'İncirliova'], 'bbox': (27.2, 37.4, 28.5, 38.0)},
    },
    'IC_ANADOLU': {
        'Konya': {'districts': ['Selçuklu', 'Karatay', 'Cihanbeyli', 'Ereğli', 'Çumra'], 'bbox': (31.4, 37.0, 33.1, 39.1)},
        'Ankara': {'districts': ['Polatlı', 'Haymana', 'Bala', 'Şereflikoçhisar'], 'bbox': (31.9, 39.0, 33.5, 40.4)},
        'Karaman': {'districts': ['Merkez', 'Ayrancı', 'Kazımkarabekir', 'Ermenek'], 'bbox': (32.8, 36.9, 33.5, 37.4)},
    },
    'AKDENIZ': {
        'Antalya': {'districts': ['Manavgat', 'Serik', 'Kumluca', 'Elmalı'], 'bbox': (29.5, 36.1, 31.5, 37.2)},
        'Adana': {'districts': ['Seyhan', 'Yüreğir', 'Ceyhan', 'Kozan'], 'bbox': (35.0, 36.6, 36.2, 37.5)},
    },
    'KARADENIZ': {
        'Samsun': {'districts': ['Bafra', 'Çarşamba', 'Vezirköprü', 'Terme'], 'bbox': (35.4, 40.9, 36.5, 41.7)},
        'Trabzon': {'districts': ['Akçaabat', 'Of', 'Vakfıkebir', 'Araklı'], 'bbox': (39.2, 40.8, 40.0, 41.1)},
    },
    'DOGU_ANADOLU': {
        'Erzurum': {'districts': ['Pasinler', 'Aşkale', 'Horasan', 'Oltu'], 'bbox': (40.5, 39.5, 42.0, 40.5)},
        'Malatya': {'districts': ['Battalgazi', 'Yeşilyurt', 'Akçadağ', 'Doğanşehir'], 'bbox': (37.5, 38.0, 38.5, 38.8)},
    },
    'GUNEY_DOGU_ANADOLU': {
        'Şanlıurfa': {'districts': ['Harran', 'Siverek', 'Viranşehir', 'Haliliye'], 'bbox': (37.9, 36.7, 39.6, 37.8)},
        'Diyarbakır': {'districts': ['Bismil', 'Ergani', 'Silvan', 'Sur'], 'bbox': (39.5, 37.7, 40.5, 38.3)},
    }
}

# Updated to match the frontend CROP_OPTIONS definitions
CROPS = [
    'Sunflowers', 'Apples', 'Clover', 'Lavender', 'Wildflowers', 
    'Olives', 'Figs', 'Thyme', 'Peaches', 'Oranges', 'Cherries', 
    'Carrots', 'Sesame', 'Watermelons', 'Hazelnuts', 'Tea', 'Cotton'
]

# Base string safely over 500 characters, sliced exactly to 500
LOREM_IPSUM_500 = (
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor "
    "incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud "
    "exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure "
    "dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. "
    "Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt "
    "mollit anim id est laborum. Pellentesque habitant morbi tristique senectus et nullam."
)[:500]

class Command(BaseCommand):
    help = 'Generates mock Farm data for Türkiye using realistic nested geography and specific crop types'

    def add_arguments(self, parser):
        parser.add_argument('count', type=int, help='The number of mock farms to create')

    def handle(self, *args, **kwargs):
        count = kwargs['count']
        
        # Ensure a User exists
        user, created = User.objects.get_or_create(
            username='mock_farmer',
            defaults={'email': 'ciftci@example.com', 'password': 'mockpassword123'}
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f'Created dummy user: {user.username}'))

        farms_to_create = []
        regions = list(TURKEY_GEO_DATA.keys()) # Matches RegionChoices exactly

        for i in range(count):
            # 2. Step down the hierarchy: Select Region -> City -> District
            selected_region = random.choice(regions)
            
            cities_in_region = list(TURKEY_GEO_DATA[selected_region].keys())
            selected_city = random.choice(cities_in_region)
            
            city_data = TURKEY_GEO_DATA[selected_region][selected_city]
            selected_district = random.choice(city_data['districts'])

            # 3. Generate coordinates bounded by the chosen city's rough area
            min_lon, min_lat, max_lon, max_lat = city_data['bbox']
            lon = random.uniform(min_lon, max_lon)  
            lat = random.uniform(min_lat, max_lat)     
            location = Point(x=lon, y=lat, srid=4326)

            farm = Farm(
                user=user,
                acres=random.randint(10, 5000),
                region=selected_region, # This perfectly matches RegionChoices.values
                city=selected_city,
                district=f"{selected_district} {i}", # Appending 'i' for uniqueness if desired
                crop=random.choice(CROPS), # Now pulls from the updated JS-friendly list
                location=location,
                description=LOREM_IPSUM_500 
            )
            farms_to_create.append(farm)

        # Bulk create for database efficiency
        Farm.objects.bulk_create(farms_to_create)

        self.stdout.write(self.style.SUCCESS(f'Successfully created {count} mock Turkish farms with logical geography!'))