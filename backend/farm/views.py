import logging

from django.shortcuts import render
from django.contrib.gis.geos import Polygon
from django.core.cache import cache

from rest_framework import viewsets
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import action

from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page

from elasticsearch_dsl import Q

from .serializers import FarmSerializer, FarmImageSerializer
from .models import Farm, FarmImages
from .documents import FarmDocument

logger = logging.getLogger(__name__)


# For one's own farmland related operations
class MyFarms(viewsets.ModelViewSet):
    serializer_class = FarmSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Farm.objects.filter(user=self.request.user)

    @action(detail=True, methods=['post'], url_path='images/upload')
    def upload_image(self, request, pk=None):
        farm = self.get_object()
        image_file = request.FILES.get('image')

        if not image_file:
            return Response({"detail": "No image provided."}, status=status.HTTP_400_BAD_REQUEST)

        farm_image = FarmImages.objects.create(farm=farm, image=image_file)
        serializer = FarmImageSerializer(farm_image)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    # ─── Custom Action: Delete Image ─────────────────────────────
    # Maps to: DELETE /farms/myfarms/{id}/images/{image_id}/delete/
    @action(detail=True, methods=['delete'], url_path=r'images/(?P<image_id>[^/.]+)/delete')
    def delete_image(self, request, image_id=None, pk=None):
        farm = self.get_object()
        try:
            image_instance = FarmImages.objects.get(id=image_id, farm=farm)
            image_instance.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except (FarmImages.DoesNotExist, ValueError, ValidationError, TypeError):
            # FarmImages has a plain integer primary key, but the URL regex
            # for image_id (`[^/.]+`) accepts *any* non-slash characters —
            # not just digits. A non-numeric image_id (e.g. a stray string,
            # or a UUID copy-pasted from a Farm) used to raise an unhandled
            # ValueError here instead of the 404 this except clause only
            # covered before, since it only listed DoesNotExist.
            logger.info("Image delete failed — no matching image %s for farm %s", image_id, pk)
            return Response({"detail": "Image not found."}, status=status.HTTP_404_NOT_FOUND)


class FarmsList(APIView):
    authentication_classes = []

    # @method_decorator(cache_page(60 * 60 * 1, key_prefix="land_list"))
    def get(self, request, *args, **kwargs):
        # 1. Start Search
        search = FarmDocument.search()
        queries = []

        # 2. Get params
        crop_param = request.query_params.get('crop')
        acres = request.query_params.get('acres__gte')
        region = request.query_params.get('region')

        # 3. Build queries
        if crop_param:
            crop_list = crop_param.split(',')
            queries.append(Q('terms', crop=crop_list))
        if acres:
            try:
                min_acres = int(acres)
            except (TypeError, ValueError):
                # Previously unguarded — a non-numeric `acres__gte` (e.g.
                # "?acres__gte=abc") raised an unhandled ValueError here
                # with nothing logged and no useful message returned.
                return Response(
                    {"detail": "'acres__gte' must be a whole number."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            queries.append(Q('range', acres={'gte': min_acres}))
        if region:
            queries.append(Q('term', region=region))

        # 4. Apply queries
        if queries:
            final_query = Q('bool', must=queries)
            search = search.query(final_query)

        # 5. Optional: Add Pagination via slicing (e.g., getting first 50 results)
        # Because we aren't using Django QuerySets, DRF's built-in paginators won't work.
        search = search[0:50]

        # 6. EXECUTE! (This hits Elasticsearch and returns JSON, bypassing SQL)
        # This call previously had no error handling at all: if Elasticsearch
        # is down, unreachable, or misconfigured (see the ELASTICSEARCH_DSL
        # auth fix in settings.py), this raised straight through as an
        # unhandled 500 with nothing logged anywhere.
        try:
            es_response = search.execute()
        except Exception:
            logger.exception("Elasticsearch query failed for farm search (params=%s)", dict(request.query_params))
            return Response(
                {"detail": "Search is temporarily unavailable. Please try again shortly."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        # 7. Format the raw Elasticsearch hits into a clean Python list
        results = []
        for hit in es_response.hits:
            # hit.to_dict() gives us the exact fields we defined in documents.py
            farm_data = hit.to_dict()

            # The document ID is usually kept in the meta data
            farm_data['id'] = hit.meta.id

            results.append(farm_data)

        # 8. Return exactly what your React frontend is expecting
        return Response({
            "count": es_response.hits.total.value,  # Total matching documents
            "results": results                      # The actual data
        })


class FarmClusterView(APIView):
    def get(self, request):
        try:
            zoom = int(request.GET.get('zoom', 6))

            # 1. Round coordinates to 2 decimal places (~1km accuracy)
            # This ensures slight map nudges hit the same cache key!
            sw_lat = round(float(request.GET.get('sw_lat')), 2)
            sw_lng = round(float(request.GET.get('sw_lng')), 2)
            ne_lat = round(float(request.GET.get('ne_lat')), 2)
            ne_lng = round(float(request.GET.get('ne_lng')), 2)

            # 2. Extract filters (moved inside this try block: min_acres is
            # parsed with int() a few lines down, and that conversion used
            # to happen *outside* any error handling at all — a non-numeric
            # 'acres__gte' raised an unhandled ValueError instead of the
            # same clean 400 the coordinate params already get below.)
            min_acres = request.GET.get('acres__gte', '')
            min_acres = int(min_acres) if min_acres else None
        except (TypeError, ValueError):
            return Response({"error": "Missing or invalid map bounds."}, status=400)

        crop_types = request.GET.get('crop_type__in', '')
        region = request.GET.get('region', '')

        # 3. Generate a unique, deterministic string for the Cache Key
        cache_key = f"clusters_z{zoom}_{sw_lat}_{sw_lng}_{ne_lat}_{ne_lng}_{crop_types}_{min_acres}_{region}"

        # 4. Check if we already did this math recently
        cached_data = cache.get(cache_key)
        if cached_data:
            return Response(cached_data)

        # --- If not in cache, do the heavy lifting ---

        bbox = Polygon.from_bbox((sw_lng, sw_lat, ne_lng, ne_lat))
        qs = Farm.objects.filter(location__within=bbox)

        if crop_types:
            qs = qs.filter(crop__in=crop_types.split(','))
        if min_acres is not None:
            qs = qs.filter(acres__gte=min_acres)
        if region:
            qs = qs.filter(region=region)

        farms = qs.values('id', 'location', 'crop', 'acres', 'district', 'city', 'region')

        grid_size = (360.0 / (2 ** zoom)) / 1.5
        clusters = {}

        for farm in farms:
            lng, lat = farm['location'].coords
            grid_x = round(lng / grid_size)
            grid_y = round(lat / grid_size)
            grid_key = (grid_x, grid_y)

            if grid_key not in clusters:
                clusters[grid_key] = {
                    'count': 1,
                    'single_id': str(farm['id']),
                    'lat': lat,
                    'lng': lng,
                    'district': farm['district'],
                    'city': farm['city'],
                    'crop_type': farm['crop'],
                    'acres': farm['acres'],
                    'region': farm['region']
                }
            else:
                cluster = clusters[grid_key]
                cluster['count'] += 1
                cluster['lat'] += (lat - cluster['lat']) / cluster['count']
                cluster['lng'] += (lng - cluster['lng']) / cluster['count']

                cluster.pop('single_id', None)
                cluster.pop('district', None)
                cluster.pop('crop_type', None)

        response_data = {'clusters': list(clusters.values())}

        # 5. Save the result to the cache for 1 hour
        cache.set(cache_key, response_data, timeout=60 * 60 * 1)

        return Response(response_data)


class FarmRetrieve(RetrieveAPIView):
    queryset = Farm.objects.all()
    serializer_class = FarmSerializer
    permission_classes = []
    lookup_field = 'id'

    # @method_decorator(cache_page(60 * 60 * 1))
    def retrieve(self, request, *args, **kwargs):
        return super().retrieve(request, *args, **kwargs)
