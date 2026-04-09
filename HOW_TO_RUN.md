# How to Run (Local Development)

This guide only covers:
- environment setup
- starting database services with Docker
- installing backend/frontend dependencies
- running migrations and seed data
- starting backend and frontend dev servers

For hosted demo deployment (GitHub + Supabase + Render + Vercel), see `DEPLOYMENT_DEMO_GUIDE.md`.

## 1. Prerequisites

- Docker + Docker Compose
- Node.js 20+
- npm

## 2. Start PostgreSQL and Redis

From the project root:

```bash
docker compose up -d db redis
```

Services from docker-compose:
- PostgreSQL: localhost:5433
- Redis: localhost:6379

## 3. Backend Setup

Open a terminal in backend:

```bash
cd backend
```

Copy env template:

```bash
cp .env.example .env
```

Edit .env and make sure at least these are correct for local Docker:

```env
PORT=5001
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/classroom_booking
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_jwt_secret_here
SESSION_SECRET=your_session_secret_here
```

Install dependencies:

```bash
npm install
```

Run migrations:

```bash
npx drizzle-kit migrate
```

Seed development data (buildings, rooms, users, assignments, courses, requests, bookings, notifications):

```bash
npm run seed:dev
```

Start backend dev server:

```bash
npm run dev
```

Backend base URL:
- http://localhost:5001

## 4. Frontend Setup

Open another terminal in frontend:

```bash
cd frontend
npm install
npm run dev
```

Frontend URL:
- http://localhost:5173

## 5. Seeded Login Accounts (Password Auth Only)

All seeded accounts use email/password login only.

Default password for seeded users:
- password123

All seeded login accounts are defined in one file:
- backend/scripts/seededLoginUsers.json

If you set `SEED_DEFAULT_PASSWORD` in backend/.env, that value overrides `defaultPassword` from this file.

## 6. Optional: Reset and Re-seed

If you want a clean database:

```bash
# from project root
docker compose down -v
docker compose up -d db redis

# then in backend
cd backend
npx drizzle-kit migrate
npm run seed:dev
```
