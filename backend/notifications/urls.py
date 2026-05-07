from django.urls import path
from . import views

urlpatterns = [
    path('',             views.NotificationListView.as_view(), name='notification-list'),
    path('read-all/',    views.MarkAllReadView.as_view(),      name='notification-read-all'),
    path('unread-count/', views.UnreadCountView.as_view(),     name='notification-unread-count'),
    path('<int:pk>/read/', views.MarkReadView.as_view(),       name='notification-read'),
]