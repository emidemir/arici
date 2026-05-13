import os
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv
from django.conf import settings

load_dotenv()

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY=os.environ.get('SECRET_KEY')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = False

ALLOWED_HOSTS = ["aricibackend.emirhanutkudemir.com", "localhost"]


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
    )
}


# =========== ELASTICSEARCH ===========
ELASTICSEARCH_DSL={
    'default': {
        'hosts': os.environ.get('ELASTICSEARCH_URL'),
        'http_auth': ('username', 'password')
    }
}


# ============ JWT CONFIG ============
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(days=1),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=1),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,

    "SIGNING_KEY": settings.SECRET_KEY,
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

# ========== CACHE BACKEND ==========
CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": f"redis://{os.environ.get('REDIS_USERNAME')}:{os.environ.get('REDIS_PASSWORD')}@{os.environ.get('REDIS_URL')}:{os.environ.get('REDIS_PORT')}/1",
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
                    "address": (os.environ.get('REDIS_URL'), int(os.environ.get('REDIS_PORT'))),
                    "password": os.environ.get('REDIS_PASSWORD'),
                    # If using Redis 6+ ACL with a username:
                    # "username": os.environ.get('REDIS_USER'),
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

