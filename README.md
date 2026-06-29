# Arıcı 🐝

**Arıcı** ("beekeeper" in Turkish) is a marketplace that connects **beekeepers** with **farmers and landowners** across Türkiye who have land suitable for placing beehives — flowering crops like sunflowers, lavender, thyme, citrus, and clover. Landowners list their farmland (with location, acreage, crop type, and photos); beekeepers search and filter listings on an interactive map and message landowners directly to arrange hive placement.

The project is a full-stack web app: a Django REST + WebSocket backend and a React single-page frontend, built around geospatial search, real-time chat, and full-text/filtered search over listings.

## Features

- **Farmland listings** — Create, edit, and browse farmland listings with crop type, acreage, region/city/district, GPS location, and photos.
- **Map-based exploration** — Browse listings on an interactive [Leaflet](https://leafletjs.com/) map with marker clustering, powered by a custom geospatial clustering endpoint.
- **Search & filtering** — Filter listings by crop type, minimum acreage, and region using Elasticsearch-backed full-text/structured search.
- **Real-time chat** — Beekeepers and landowners message each other over WebSockets (Django Channels), with optimistic UI updates, read receipts, and a REST fallback for sending messages.
- **Notifications** — In-app notifications for new messages (and other event types), with unread counts polled by the navbar.
- **Authentication** — JWT-based signup/login/logout with access + refresh tokens, automatic refresh, and blacklisting on logout.
- **Image storage** — Farm photos are uploaded to S3-compatible object storage (MinIO in development).
- **Rate limiting** — Redis-backed middleware limits requests per user/IP.
- **API documentation** — Auto-generated Swagger/ReDoc docs via `drf-yasg`.

## Tech Stack

### Backend (`backend/`)

| Component | Technology |
|---|---|
| Framework | [Django](https://www.djangoproject.com/) 6 + [Django REST Framework](https://www.django-rest-framework.org/) |
| Real-time | [Django Channels](https://channels.readthedocs.io/) + [Daphne](https://github.com/django/daphne) (ASGI) |
| Database | [PostgreSQL](https://www.postgresql.org/) + [PostGIS](https://postgis.net/) (via GeoDjango) |
| Search | [Elasticsearch](https://www.elastic.co/) via `django-elasticsearch-dsl` |
| Cache / channel layer / rate limiting | [Redis](https://redis.io/) |
| Object storage | S3-compatible storage ([MinIO](https://min.io/) locally) via `django-storages` |
| Auth | JWT via `djangorestframework-simplejwt` |
| Payments | [Stripe](https://stripe.com/) (configured, not yet wired into a view) |
| API docs | `drf-yasg` (Swagger / ReDoc) |

### Frontend (`frontend/`)

| Component | Technology |
|---|---|
| Framework | [React 19](https://react.dev/) (Create React App / `react-scripts`) |
| Routing | [React Router v7](https://reactrouter.com/) |
| Map | [react-leaflet](https://react-leaflet.js.org/) |
| Auth/session | Custom `AuthContext` + `TokenManager` (JWT access/refresh, auto-refresh) |
| Serving (prod) | Static build served via Nginx, reverse-proxying API calls to the backend |

### Infrastructure

- `docker-compose.yml` spins up the **infrastructure dependencies**: PostGIS, Redis, Elasticsearch, and MinIO.
- `backend/Dockerfile` and `frontend/Dockerfile` build the app images themselves (not included in the compose file — see [Running with Docker](#running-with-docker) below).
- The frontend's Nginx config proxies `/api`, `/users`, `/admin`, `/static`, and `/media` to the backend container and falls back to `index.html` for client-side routing.

## Project Structure

```
arici/
├── backend/                 # Django project
│   ├── config/               # Project settings, root URLs, ASGI app, middleware
│   │   └── middlewares/        # Custom Redis-backed rate limiting middleware
│   ├── user/                  # Custom user model, signup/login/logout (JWT)
│   ├── farm/                  # Farmland listings, images, geospatial search, clustering
│   │   ├── documents.py         # Elasticsearch document mapping for Farm
│   │   └── management/commands/generate_data.py  # Generates realistic mock Turkish farm data
│   ├── chat/                  # Conversations, messages, WebSocket consumer
│   ├── notifications/         # In-app notifications (messages, etc.)
│   ├── manage.py
│   └── requirements.txt
├── frontend/                 # React SPA
│   ├── src/
│   │   ├── api/                 # Authenticated fetch wrapper
│   │   ├── lib/                 # TokenManager (JWT refresh), API URL helper
│   │   ├── context/             # AuthContext (session/auth state)
│   │   ├── features/
│   │   │   ├── auth/              # Login, signup, protected routes
│   │   │   ├── lands/              # Map, listing list, listing detail
│   │   │   ├── chats/              # Chat UI (WebSocket client)
│   │   │   └── profile/            # Dashboard, "my farms" CRUD
│   │   ├── components/commons/  # Navbar, shared UI
│   │   └── pages/                # Top-level routed pages (e.g. ExplorePage)
│   ├── public/
│   └── nginx.conf             # Production reverse-proxy config
├── photos/                   # Sample farmland photos used for demo/seed data
├── docker-compose.yml         # Infra services: postgis, redis, elasticsearch, minio
└── current_bugs.txt           # Known issues / TODOs
```

## Getting Started

### Prerequisites

- Python 3.12+
- Node.js 20+
- Docker & Docker Compose
- GDAL / GEOS / PROJ libraries (required by GeoDjango — installed automatically in the Docker image; on macOS you can `brew install gdal geos`, on Ubuntu `apt install gdal-bin libgdal-dev libgeos-dev`)

### 1. Clone the repository

```bash
git clone https://github.com/emidemir/arici.git
cd arici
```

### 2. Configure environment variables

Create a `.env` file in the project root (used by both `docker-compose.yml` and the Django backend). The backend expects the following variables (see `backend/config/settings.py`):

```bash
# Django
SECRET_KEY=

# PostgreSQL / PostGIS
POSTGRES_DB_NAME=
POSTGRES_DB_USER=
POSTGRES_DB_PASSWORD=
POSTGRES_DB_HOST=
POSTGRES_DB_PORT=

# Redis (cache, channel layer, rate limiting)
REDIS_URL=
REDIS_PORT=
REDIS_USERNAME=
REDIS_PASSWORD=

# Elasticsearch
ELASTICSEARCH_URL=

# S3-compatible storage (MinIO locally)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_STORAGE_BUCKET_NAME=
AWS_S3_ENDPOINT_URL=

# Stripe
STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_CURRENCY=
STRIPE_WEBHOOK_SECRET=
```

The frontend reads a single build-time variable:

```bash
REACT_APP_BACKEND_URL=http://localhost:8000
```

> ⚠️ **Security note:** this repository currently has a `.env` file committed to version control (despite `.env` being listed in `.gitignore`). If that file contains real credentials, **rotate them and remove the file from git history** before making the repository public or deploying it.

### 3. Start infrastructure services

```bash
docker compose up -d
```

This starts PostGIS (`localhost:5432`), Redis (`localhost:6379`), Elasticsearch (`localhost:9200`), and MinIO (API on `localhost:9000`, console on `localhost:9001`, default credentials `minioadmin` / `minioadmin`).

Create the storage bucket named in `AWS_STORAGE_BUCKET_NAME` via the MinIO console before uploading any farm images.

### 4. Backend setup

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

python manage.py migrate
python manage.py createsuperuser   # optional, for /admin/

# Build the Elasticsearch index used by farm search/filtering
python manage.py search_index --rebuild

# Optional: generate mock farmland listings across Turkish regions
python manage.py generate_data 100

# Run the ASGI server (required for WebSocket chat support)
daphne -b 0.0.0.0 -p 8000 config.asgi:application
```

The API is now available at `http://localhost:8000/`, with Swagger docs at `/swagger/` and ReDoc at `/redoc/`.

### 5. Frontend setup

```bash
cd frontend
npm install
npm start
```

The app runs at `http://localhost:3000/` and talks to the backend via `REACT_APP_BACKEND_URL`.

## Running with Docker

`docker-compose.yml` as committed only provisions the **infrastructure** (database, cache, search, object storage) — it does not yet build/run the `backend` or `frontend` images. Each app has its own `Dockerfile`:

- `backend/Dockerfile` — installs GDAL/GEOS/PostGIS system deps, installs Python requirements, and runs the app with `daphne` on port 8000.
- `frontend/Dockerfile` — multi-stage build: compiles the React app with `REACT_APP_BACKEND_URL` baked in at build time, then serves the static build with Nginx on port 80 (see `frontend/nginx.conf` for the reverse-proxy rules).

To run the full stack in containers, add `backend` and `frontend` services to `docker-compose.yml` (or run them separately) on the same `arici` network, for example:

```yaml
  backend:
    build: ./backend
    env_file: .env
    ports:
      - "8000:8000"
    depends_on:
      - postgis
      - redis
      - elasticsearch
    networks:
      - arici

  frontend:
    build:
      context: ./frontend
      args:
        REACT_APP_BACKEND_URL: "http://localhost:8000"
    container_name: arici_backend   # must match the name nginx.conf proxies to
    ports:
      - "80:80"
    networks:
      - arici
```

> Note: `frontend/nginx.conf` proxies API requests to a host named `arici_backend` — make sure your backend service/container is named (or aliased) accordingly if you containerize it.

## API Overview

All endpoints are mounted under the root URLconf (`backend/config/urls.py`):

| Prefix | App | Description |
|---|---|---|
| `/api/token/`, `/api/token/refresh/`, `/api/token/verify/` | — | JWT obtain/refresh/verify (SimpleJWT) |
| `/users/` | `user` | Signup, login, logout |
| `/farms/` | `farm` | Listings: list/search, retrieve, cluster, and CRUD on your own listings (`/farms/myfarms/`) plus image upload/delete |
| `/chats/` | `chat` | Conversations and messages (REST) |
| `/notifications/` | `notifications` | List, mark read, unread count |
| `/admin/` | Django admin | |
| `/swagger/`, `/redoc/` | `drf-yasg` | Interactive API docs |

**WebSocket:** `ws/chat/<conversation_id>/?token=<jwt_access_token>` — real-time bidirectional chat, authenticated via JWT passed as a query parameter (browsers can't set custom headers on WebSocket connections). Message types include `chat.message` and `chat.read`.

### Key `farm` endpoints

- `GET /farms/list/?crop=Lavender,Thyme&acres__gte=50&region=AKDENIZ` — Elasticsearch-backed search/filtering.
- `GET /farms/clusters/?zoom=6&sw_lat=&sw_lng=&ne_lat=&ne_lng=` — grid-based marker clustering for the map view, cached in Redis for an hour.
- `GET /farms/retrieve/<id>/` — single listing detail.
- `/farms/myfarms/` (DRF router) — authenticated CRUD for the current user's own listings, plus `POST /farms/myfarms/<id>/images/upload/` and `DELETE /farms/myfarms/<id>/images/<image_id>/delete/`.

## Known Issues / TODOs

See [`current_bugs.txt`](./current_bugs.txt) for the maintainer's working notes, including:
- Logout currently waits on an in-flight notification call to finish before completing.
- Deployment is planned via [Coolify](https://coolify.io/) using a GitHub deploy key.

## License

No license file is currently included in this repository. Add a `LICENSE` file to clarify how others may use this code.