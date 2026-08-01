import logging

import jwt
import redis
from django.conf import settings
from django.http import JsonResponse

logger = logging.getLogger(__name__)

# NOTE: settings.REDIS_HOST / REDIS_PORT / REDIS_USERNAME / REDIS_PASSWORD
# are now real Django settings (see config/settings.py) built from the same
# REDIS_URL / REDIS_PORT / REDIS_USERNAME / REDIS_PASSWORD env vars used by
# CACHES and CHANNEL_LAYERS. Previously `getattr(settings, 'REDIS_HOST',
# 'localhost')` silently returned 'localhost' on every single request,
# because `REDIS_HOST` was never actually defined as a setting anywhere —
# so this middleware connected to a Redis instance that had nothing to do
# with the one configured in .env, with no authentication, and never once
# reported that mismatch. This client is also now recreated whenever the
# module is imported, so tests / a fresh process can override settings
# before Redis connects.
redis_client = redis.StrictRedis(
    host=settings.REDIS_HOST,
    port=settings.REDIS_PORT,
    username=settings.REDIS_USERNAME,
    password=settings.REDIS_PASSWORD,
    db=0,
    decode_responses=True,
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
                logger.warning(
                    "Rate limit exceeded for %s on %s %s (%s requests)",
                    identifier, request.method, request.path, request_count,
                )
                return JsonResponse(
                    {"error": "Too Many Requests", "detail": "Rate limit exceeded. Please try again later."},
                    status=429
                )
        except redis.RedisError:
            # Fail open — if Redis is down, don't block legitimate traffic.
            # This used to be a bare `pass`, so Redis being unreachable (or
            # misconfigured — see the note above) looked identical to rate
            # limiting simply being disabled. Now it's at least visible.
            logger.warning(
                "Rate limiter could not reach Redis at %s:%s — failing open for %s %s",
                settings.REDIS_HOST, settings.REDIS_PORT, request.method, request.path,
                exc_info=True,
            )

        return self.get_response(request)

    def get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0]
        return request.META.get('REMOTE_ADDR')

    def get_user_id_from_jwt(self, request):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return None

        parts = auth_header.split(' ', 1)
        if len(parts) != 2 or not parts[1]:
            # Malformed header (e.g. just "Bearer" with no token). This used
            # to raise an unhandled IndexError from `.split(' ')[1]` and
            # take the whole request down with it.
            logger.debug("Malformed Authorization header on %s", request.path)
            return None

        token = parts[1]
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
            return payload.get('user_id')
        except (jwt.ExpiredSignatureError, jwt.DecodeError, jwt.InvalidTokenError) as e:
            # Expected/routine — an expired or malformed token just means we
            # fall back to rate-limiting by IP instead of by user.
            logger.debug("Could not decode JWT for rate limiting on %s: %s", request.path, e)
            return None
