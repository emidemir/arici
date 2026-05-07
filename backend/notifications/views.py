from django.shortcuts import render

# Create your views here.
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Notification
from .serializers import NotificationSerializer


class NotificationListView(APIView):
    """GET /notifications/  — latest 30 for the current user"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        notifs = Notification.objects.filter(recipient=request.user)[:30]
        return Response(NotificationSerializer(notifs, many=True).data)


class MarkReadView(APIView):
    """PATCH /notifications/<id>/read/"""
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        notif = Notification.objects.filter(pk=pk, recipient=request.user).first()
        if notif:
            notif.is_read = True
            notif.save(update_fields=['is_read'])
        return Response({'ok': True})


class MarkAllReadView(APIView):
    """POST /notifications/read-all/"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        Notification.objects.filter(recipient=request.user, is_read=False).update(is_read=True)
        return Response({'ok': True})


class UnreadCountView(APIView):
    """GET /notifications/unread-count/  — polled by Navbar badge"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        count = Notification.objects.filter(recipient=request.user, is_read=False).count()
        return Response({'count': count})