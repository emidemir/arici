import os
from pathlib import Path
from datetime import timedelta
from urllib.parse import urlparse
from dotenv import load_dotenv
from django.core.exceptions import ImproperlyConfigured

load_dotenv()

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent


def env_int(name, default=None):
    """
    Read an integer environment variable.

    Doing `int(os.environ.get('X'))` directly blows up at import time with a
    generic `TypeError: int() argument must be a string... not 'NoneType'`
    whenever the variable is missing from `.env` — which doesn't say *which*
    variable is missing. This raises a clear, actionable error instead (or
    falls back to `default` when one is provided).
    """
    value = os.environ.get(name)
    if value is None or value == '':
        if default is not None:
            return default
        raise ImproperlyConfigured(
            f"Required environment variable '{name}' is not set or empty. "
            f"Check your .env file (see README.md for the full list of required variables)."
        )
    try:
        return int(value)
    except ValueError:
        raise ImproperlyConfigured(
            f"Environment variable '{name}' must be an integer, got: {value!r}"
        )

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY=os.environ.get('SECRET_KEY')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = False

ALLOWED_HOSTS = ["arici.emirhanutkudemir.com", "localhost"]

# Application definition

INSTALLED_APPS = [
    'daphne',
    'channels', # For the chat app, websocket bidirectional communication

    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.gis', #https://stackoverflow.com/a/25223512/17799171

    # THIRD PARTY APPS
    'rest_framework',
    'corsheaders',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist', # for logout view
    'storages',
    'django_elasticsearch_dsl',

    # DJANGO APPS
    'user',
    'farm',
    'chat',
    'notifications',
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware", # Cors middleware
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'config.middlewares.rateLimiter.RateLimitingMiddleware', # Rate limiting is provided via this middleware
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# Password validation
# https://docs.djangoproject.com/en/6.0/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
# https://docs.djangoproject.com/en/6.0/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/6.0/howto/static-files/

STATIC_URL = 'static/'


AUTH_USER_MODEL='user.User'

# ========== REST FRAMEWORK ==========
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    # Logs every exception (and returns a clean, generic body for anything
    # DRF doesn't already recognise) instead of unhandled errors vanishing
    # silently. See config/exception_handler.py.
    'EXCEPTION_HANDLER': 'config.exception_handler.custom_exception_handler',
}


# =========== ELASTICSEARCH ===========
# Only send http_auth if real credentials are configured — previously this
# was hardcoded to the literal strings ('username', 'password'), which is a
# placeholder, not real auth. Sending bogus Basic Auth to a cluster that
# doesn't need it is harmless (security is disabled in docker-compose.yml),
# but it would fail authentication against any ES cluster that *does* have
# security enabled, so it's wrong either way.
_es_username = os.environ.get('ELASTICSEARCH_USERNAME')
_es_password = os.environ.get('ELASTICSEARCH_PASSWORD')

ELASTICSEARCH_DSL = {
    'default': {
        'hosts': os.environ.get('ELASTICSEARCH_URL'),
        **({'http_auth': (_es_username, _es_password)} if _es_username and _es_password else {}),
    }
}


# ============ JWT CONFIG ============
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(days=1),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=1),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,

    "SIGNING_KEY": SECRET_KEY,
}

# ============ DATABASE ============
DATABASES = {
    'default': {
        'ENGINE': 'django.contrib.gis.db.backends.postgis', # https://stackoverflow.com/a/65447921/17799171
        'NAME': os.environ.get('POSTGRES_DB_NAME'),
        'USER': os.environ.get('POSTGRES_DB_USER'),
        'PASSWORD': os.environ.get('POSTGRES_DB_PASSWORD'),
        'HOST': os.environ.get('POSTGRES_DB_HOST'),
        'PORT': os.environ.get('POSTGRES_DB_PORT'),
    }
}

# ========== CORS CONFIGS ==========
# CORS_ALLOW_ALL_ORIGINS = True # Use this in production, I guess??
CORS_ALLOWED_ORIGINS = [
    "https://aricifrontend.emirhanutkudemir.com",
]

def redis_host_from_env(value, default='localhost'):
    """
    REDIS_URL is supposed to be a bare hostname ('127.0.0.1', 'redis', ...)
    — that's how it's used everywhere below (CACHES' LOCATION string,
    CHANNEL_LAYERS' address tuple, the rate limiter's redis.StrictRedis
    call). This project's own committed backend/.env sets it to a *full*
    URL instead (`REDIS_URL=redis://127.0.0.1`), which every one of those
    consumers was treating as a literal hostname:
      - redis.StrictRedis(host='redis://127.0.0.1', ...) fails with
        "Name or service not known" (it's not a valid hostname).
      - CACHES' LOCATION became the doubly-prefixed, invalid
        'redis://user:pass@redis://127.0.0.1:6379/1'.
      - CHANNEL_LAYERS (Django Channels' Redis-backed channel layer, which
        the real-time chat feature depends on entirely) got the same
        broken host.
    This accepts either form so a stray 'redis://' in .env doesn't quietly
    break caching, rate limiting, and real-time chat all at once.
    """
    if not value:
        return default
    if '://' in value:
        return urlparse(value).hostname or default
    return value


# ========== REDIS (cache, channel layer, rate limiting) ==========
# Single source of truth for Redis connection settings. Previously these
# were read ad-hoc via os.environ.get(...) inline wherever they were needed
# (CACHES, CHANNEL_LAYERS below), and config/middlewares/rateLimiter.py
# looked for a `REDIS_HOST` setting that was never defined here at all —
# so it silently fell back to its own 'localhost' default no matter what
# REDIS_URL actually said, and any connection error was swallowed with a
# bare `except: pass`. Defining real settings here means every consumer
# (cache, channel layer, rate limiter) reads the same, normalized values.
REDIS_HOST = redis_host_from_env(os.environ.get('REDIS_URL'))
REDIS_PORT = env_int('REDIS_PORT', default=6379)
REDIS_USERNAME = os.environ.get('REDIS_USERNAME') or None
REDIS_PASSWORD = os.environ.get('REDIS_PASSWORD') or None

# ========== CACHE BACKEND ==========
CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": f"redis://{REDIS_USERNAME or ''}:{REDIS_PASSWORD or ''}@{REDIS_HOST}:{REDIS_PORT}/1",
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
        }
    }
}

# ========== MINIO CONFIGS ==========
AWS_ACCESS_KEY_ID = os.environ.get('AWS_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = os.environ.get('AWS_SECRET_ACCESS_KEY')

# 2. The Bucket — create this in the MinIO console beforehand
AWS_STORAGE_BUCKET_NAME = os.environ.get('AWS_STORAGE_BUCKET_NAME')

# 3. Endpoint — overrides the default AWS URL and points boto3 at your MinIO instance
AWS_S3_ENDPOINT_URL = os.environ.get('AWS_S3_ENDPOINT_URL')  # e.g. http://127.0.0.1:9000

# 4. SSL — set False for local HTTP development; True in production with HTTPS
AWS_S3_USE_SSL = True

# 5. Don't add authentication query params to every image URL
#    (Safe to disable when your bucket policy is set to public read)
AWS_QUERYSTRING_AUTH = False

# 6. Prevent files with the same name from overwriting each other
AWS_S3_FILE_OVERWRITE = False

# 7. Build the custom domain so generated URLs point at MinIO, not AWS
#    Results in something like: 127.0.0.1:9000/products
# AWS_S3_CUSTOM_DOMAIN = f"{AWS_S3_ENDPOINT_URL.split('//')[1]}/{AWS_STORAGE_BUCKET_NAME}"

# 8. Ensure generated URLs use http in local dev
AWS_S3_URL_PROTOCOL = 'http:'
AWS_S3_ADDRESSING_STYLE = "path"

# 9. Route Django's default file storage through S3/MinIO
STORAGES = {
    "default": {
        "BACKEND": "storages.backends.s3boto3.S3Boto3Storage",
    },
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
}


# ========== STRIPE CONFIGS ==========
STRIPE_PUBLISHABLE_KEY = os.environ.get('STRIPE_PUBLISHABLE_KEY')
STRIPE_SECRET_KEY      = os.environ.get('STRIPE_SECRET_KEY')
STRIPE_CURRENCY        = os.environ.get('STRIPE_CURRENCY')
STRIPE_WEBHOOK_SECRET  = os.environ.get('STRIPE_WEBHOOK_SECRET')


# ====== CHANNELS (ASGI) CONFIGS ======
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [
                {
                    "host": REDIS_HOST,
                    "port": REDIS_PORT,
                    "password": REDIS_PASSWORD,
                    **({"username": REDIS_USERNAME} if REDIS_USERNAME else {}),
                }
            ],
        },
    },
}
ASGI_APPLICATION = 'config.asgi.application'

# ====== SSL ======
# These fight with Traefik's SSL termination — disable or adjust:
SECURE_SSL_REDIRECT = False  # Traefik handles this
SESSION_COOKIE_SECURE = True  # keep
CSRF_COOKIE_SECURE = True     # keep
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# Tell Django it's behind a trusted proxy:
USE_X_FORWARDED_HOST = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# ========== LOGGING ==========
# There was no LOGGING setting at all before this. That matters more than it
# sounds like it should:
#   - Django's own DEFAULT_LOGGING only sends the 'django' logger to the
#     console when DEBUG=True (behind a require_debug_true filter), and
#     routes errors to AdminEmailHandler otherwise — which does nothing
#     here since ADMINS/email aren't configured. With DEBUG=False (as set
#     above), Django's own request/500 logging was going nowhere.
#   - Every app in this project (chat, farm, user, notifications,
#     config.middlewares) calls `logging.getLogger(__name__)` expecting it
#     to end up somewhere. Without an explicit LOGGING dict those loggers
#     have no handlers of their own and fall back to Python's "handler of
#     last resort", which is unformatted and easy to miss.
#
# This app runs via `daphne ... config.asgi:application` in a container
# (see backend/Dockerfile), so a single console handler is the right call —
# stdout/stderr is what `docker logs` / the hosting platform captures.
# Verbosity is controlled by DJANGO_LOG_LEVEL so it can be turned up for
# troubleshooting without a code change or redeploy.
DJANGO_LOG_LEVEL = os.environ.get('DJANGO_LOG_LEVEL', 'INFO').upper()

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{asctime} {levelname:<8} {name} — {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    # Fallback for anything not explicitly named below (third-party
    # libraries like elasticsearch/botocore/urllib3, etc.) so nothing is
    # silently dropped just because we didn't think to name it.
    'root': {
        'handlers': ['console'],
        'level': DJANGO_LOG_LEVEL,
    },
    'loggers': {
        # Django's own framework logging (migrations, template errors, etc).
        'django': {
            'handlers': ['console'],
            'level': DJANGO_LOG_LEVEL,
            'propagate': False,
        },
        # Unhandled view exceptions (500s) and bad requests (400s/404s).
        # This is what used to disappear entirely with DEBUG=False.
        'django.request': {
            'handlers': ['console'],
            'level': 'ERROR',
            'propagate': False,
        },
        'django.channels': {
            'handlers': ['console'],
            'level': DJANGO_LOG_LEVEL,
            'propagate': False,
        },
        'daphne': {
            'handlers': ['console'],
            'level': DJANGO_LOG_LEVEL,
            'propagate': False,
        },
        # This project's apps. Code should log via
        # `logging.getLogger(__name__)`, e.g. inside farm/views.py that's
        # "farm.views" — it has no handler of its own, so it propagates up
        # to the "farm" logger below and is handled there.
        'user': {'handlers': ['console'], 'level': DJANGO_LOG_LEVEL, 'propagate': False},
        'farm': {'handlers': ['console'], 'level': DJANGO_LOG_LEVEL, 'propagate': False},
        'chat': {'handlers': ['console'], 'level': DJANGO_LOG_LEVEL, 'propagate': False},
        'notifications': {'handlers': ['console'], 'level': DJANGO_LOG_LEVEL, 'propagate': False},
        'config': {'handlers': ['console'], 'level': DJANGO_LOG_LEVEL, 'propagate': False},
    },
}