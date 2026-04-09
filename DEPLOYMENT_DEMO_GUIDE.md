# Deployment Guide (GitHub + Supabase + Render + Vercel)

This project can be deployed for demos with:
- Source control: GitHub
- Database: Supabase Postgres
- Backend API: Render
- Frontend SPA: Vercel

## 1. Push Code To GitHub

1. Create a GitHub repository.
2. Push this project to your default branch.
3. Keep backend and frontend in the same repo (monorepo style).

## 2. Create Supabase Database

1. Create a new Supabase project.
2. Go to Project Settings -> Database.
3. Copy the Postgres connection string.
4. Make sure your connection string includes sslmode=require.

Example:

postgresql://postgres.your_ref:YOUR_PASSWORD@aws-0-region.pooler.supabase.com:6543/postgres?sslmode=require

## 3. Run Migrations (And Optional Seed)

Run this once against Supabase before first demo.
2026-04-10 00:00:36 [error]: [GET /health/ready] Query:{} - 503 (32ms) 
1. In a local terminal, set DATABASE_URL to your Supabase URL.
2. Run migrations:

npm --prefix backend run db:migrate

3. Optional: seed demo data/users:

npm --prefix backend run seed:dev

## 4. Deploy Backend On Render

Use the included render.yaml (Blueprint) or create service manually.

### Option A: Blueprint

1. In Render, click New + -> Blueprint.
2. Connect your GitHub repo.
3. Render reads render.yaml and creates the backend service.

### Option B: Manual Web Service

Use these settings:
- Root Directory: backend
- Build Command: npm ci && npm run build
- Start Command: npm run start
- Health Check Path: /health

Set environment variables in Render:
- NODE_ENV=production
- DATABASE_URL=<Supabase connection string>
- JWT_SECRET=<strong random secret>
- SESSION_SECRET=<strong random secret>
- FRONTEND_URL=https://<your-vercel-domain>
- CORS_ORIGINS=https://<your-vercel-domain>
- GOOGLE_CLIENT_ID=<from Google Cloud>
- GOOGLE_CLIENT_SECRET=<from Google Cloud>
- GOOGLE_CALLBACK_URL=https://<your-render-service>.onrender.com/api/auth/google/callback
- REDIS_URL=<optional; Render Key Value Redis or Upstash>

Notes:
- REDIS_URL is optional for demo. Without it, app falls back to in-memory rate limit/cache behavior.
- Render free tier may cold start after inactivity.

## 5. Deploy Frontend On Vercel

1. Import the same GitHub repo in Vercel.
2. Set Root Directory to frontend.
3. Framework preset: Vite.
4. Add environment variable:

VITE_API_BASE_URL=https://<your-render-service>.onrender.com/api

5. Deploy.

The frontend already includes vercel.json for SPA route fallback.

## 6. Configure Google OAuth

In Google Cloud Console (OAuth client):

1. Authorized JavaScript origins:
- https://<your-vercel-domain>

2. Authorized redirect URIs:
- https://<your-render-service>.onrender.com/api/auth/google/callback

Then copy client id/secret into Render env vars.

## 7. Demo Smoke Test Checklist

1. Open Vercel app URL.
2. Email/password login works.
3. Google login works.
4. API health works at:
- https://<your-render-service>.onrender.com/health
5. Data is loaded from Supabase-backed API.

## 8. Typical Demo Troubleshooting

- 401 after login:
  - Check JWT_SECRET and SESSION_SECRET are set.

- Google OAuth fails:
  - Check GOOGLE_CALLBACK_URL exactly matches Google Console redirect URI.
  - Check FRONTEND_URL and CORS_ORIGINS match your Vercel domain.

- Frontend cannot load API:
  - Check VITE_API_BASE_URL is set in Vercel project env vars.
  - Redeploy frontend after env var changes.

- Database connection errors:
  - Verify Supabase DB password and sslmode=require.

