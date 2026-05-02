from django.urls import path

from .views import SignupView, LoginView, LogoutView

urlpatterns = [
    path('login/', LoginView.as_view(), name='login_user'),
    path('signup/', SignupView.as_view(), name='signup_user'),
    path('logout/', LogoutView, name='logout_user'),
]