import jwt
import redis
from django.conf import settings
from django.http import JsonResponse

redis_client = redis.StrictRedis(
    host=getattr(settings, 'REDIS_HOST', 'localhost'),
    port=getattr(settings, 'REDIS_PORT', 6379),
    db=0,
    decode_responses=True
)

class RateLimitingMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        self.rate_limit  = 100  # Max requests per window
        self.time_window = 60   # Window size in seconds

    def __call__(self, request):
        client_ip = self.get_client_ip(request)
        user_id   = self.get_user_id_from_jwt(request)

        identifier = f"user:{user_id}" if user_id else f"ip:{client_ip}"
        redis_key  = f"rate_limit:{identifier}"

        try:
            request_count = redis_client.incr(redis_key)
            if request_count == 1:
                redis_client.expire(redis_key, self.time_window)

            if request_count > self.rate_limit:
                return JsonResponse(
                    {"error": "Too Many Requests", "detail": "Rate limit exceeded. Please try again later."},
                    status=429
                )
        except redis.RedisError:
            # Fail open — if Redis is down, don't block legitimate traffic.
            # Log this in production.
            pass

        return self.get_response(request)

    def get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0]
        return request.META.get('REMOTE_ADDR')

    def get_user_id_from_jwt(self, request):
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            try:
                payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
                return payload.get('user_id')
            except (jwt.ExpiredSignatureError, jwt.DecodeError):
                return None
        return None