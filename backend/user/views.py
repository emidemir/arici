from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework.decorators import api_view

from .serializers import LoginSerializer, SignupSerializer

# Create your views here.
class SignupView(APIView):
    permission_classes = []  # public endpoint

    def post(self, request):
        serializer = SignupSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response({"detail": "Account created."}, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    permission_classes = []

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.validated_data["user"]
            refresh = RefreshToken.for_user(user)
            return Response({"user_id": user.id ,"refresh_token": str(refresh), "access_token": str(refresh.access_token)})
        return Response(serializer.errors, status=status.HTTP_401_UNAUTHORIZED)
    
@api_view(['POST'])
def LogoutView(request):
    refresh = request.data.get('refresh')
    if not refresh:
        return Response({"detail": "Refresh token required."}, status=status.HTTP_400_BAD_REQUEST)
    try:
        token = RefreshToken(refresh)
        token.blacklist()
    except TokenError:
        return Response({"detail": "Invalid or expired token."}, status=status.HTTP_400_BAD_REQUEST)
    return Response(status=status.HTTP_204_NO_CONTENT)