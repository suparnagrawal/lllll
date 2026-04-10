# How to Run (Development + Deployment)

This guide covers:
- local development setup
- migration + seed workflow
- required validation commands
- full Docker deployment

## 1. Prerequisites

- Docker and Docker Compose (`docker-compose`)
- Node.js 20+
- npm

## 2. Local Development Setup

From the project root, start only data services:

```bash
docker-compose up -d db redis
```

Service ports:
- PostgreSQL: `localhost:5433`
- Redis: `localhost:6379`

## 3. Backend Setup

```bash
cd backend
cp .env.example .env
npm install
```

Ensure backend `.env` uses the local Docker defaults:

```env
DATABASE_URL=postgres://ura_user:ura_pass@localhost:5433/ura_system
REDIS_URL=redis://localhost:6379
PORT=5000
FRONTEND_URL=http://localhost:5173
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
JWT_SECRET=replace_with_strong_random_secret
SESSION_SECRET=replace_with_strong_random_session_secret
```

Run migrations and seed data:

```bash
npx drizzle-kit migrate
npm run seed:dev
```

Start backend:

```bash
npm run dev
```

Backend URL:
- `http://localhost:5000`

## 4. Frontend Setup

In a new terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend URL:
- `http://localhost:5173`

Frontend uses `/api` and proxies to backend during development.

## 5. Required Validation Commands

From the project root:

```bash
npm --prefix backend exec tsc -- --noEmit -p backend/tsconfig.json
npm --prefix backend test
npm --prefix backend run build
npm --prefix frontend test
npm --prefix frontend run build
```

## 6. Full Docker Deployment

This runs PostgreSQL, Redis, backend API, and frontend (Nginx) together.

1. Optionally set strong secrets in shell env before startup:

```bash
export JWT_SECRET="change_this"
export SESSION_SECRET="change_this"
```

2. Build and start all services:

```bash
docker-compose up --build
```

Service URLs:
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5000/api`
- Health check: `http://localhost:5000/health`

## 7. Migration Troubleshooting

If `drizzle-kit migrate` fails on an old local database state, reset local DB volumes and re-run migrations:

```bash
docker-compose down -v
docker-compose up -d db redis
cd backend
npx drizzle-kit migrate
npm run seed:dev
```

The migration chain has been verified on a fresh database.

## 8. Seeded Login Accounts (Password Auth)

- Default password: `password123`
- Seeded users file: `backend/scripts/seededLoginUsers.json`
- `SEED_DEFAULT_PASSWORD` in backend `.env` overrides the default password
