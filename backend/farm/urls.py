from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import FarmsList, FarmRetrieve, MyFarms, FarmClusterView

router = DefaultRouter()
router.register(prefix=r'myfarms', viewset=MyFarms, basename='myfarm')

urlpatterns = [
    path('list/', FarmsList.as_view(), name='list_farms'),
    path('retrieve/<str:id>/', FarmRetrieve.as_view(), name='get_farm'),
    path('clusters/', FarmClusterView.as_view(), name='cluster_farms'),
    path('', include(router.urls)),
]