import logging

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework.decorators import api_view

from .serializers import LoginSerializer, SignupSerializer

logger = logging.getLogger(__name__)


# Create your views here.
class SignupView(APIView):
    permission_classes = []  # public endpoint

    def post(self, request):
        serializer = SignupSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            logger.info("New account created: %s", user.username)
            return Response({"detail": "Account created."}, status=status.HTTP_201_CREATED)
        logger.info("Signup validation failed: %s", serializer.errors)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    permission_classes = []

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        if serializer.is_valid():
            user = serializer.validated_data["user"]
            refresh = RefreshToken.for_user(user)
            logger.info("User logged in: %s", user.username)
            return Response({
                "user_id": user.id,
                "username": user.username,
                "email": user.email,
                "refresh_token": str(refresh),
                "access_token": str(refresh.access_token),
            })
        logger.info("Login failed for username=%r: %s", request.data.get("username"), serializer.errors)
        return Response(serializer.errors, status=status.HTTP_401_UNAUTHORIZED)

@api_view(['POST'])
def LogoutView(request):
    refresh = request.data.get('refresh')
    if not refresh:
        return Response({"detail": "Refresh token required."}, status=status.HTTP_400_BAD_REQUEST)
    try:
        token = RefreshToken(refresh)
        token.blacklist()
    except TokenError as e:
        logger.info("Logout with invalid/expired token: %s", e)
        return Response({"detail": "Invalid or expired token."}, status=status.HTTP_400_BAD_REQUEST)
    return Response(status=status.HTTP_204_NO_CONTENT)