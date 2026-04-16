# Production Deployment Guide (Render + Vercel + Neon)

This guide deploys:
- Backend: Render Web Service
- Frontend: Vercel (Vite SPA)
- Database: Neon PostgreSQL

## 1) Required Environment Variables

### Backend (Render)
Set these in Render service settings: **Environment > Environment Variables**.

- `NODE_ENV=production`
- `PORT=10000` (Render default internal port; backend reads `PORT`)
- `DATABASE_URL=<Neon pooled connection string>`
- `DATABASE_SSL=true`
- `DATABASE_SSL_REJECT_UNAUTHORIZED=false`
- `DB_POOL_MAX=20`
- `DB_IDLE_TIMEOUT_MS=30000`
- `DB_CONNECTION_TIMEOUT_MS=10000`
- `JWT_SECRET=<strong random secret>`
- `SESSION_SECRET=<strong random secret>`
- `FRONTEND_URL=https://your-frontend-domain.vercel.app`
- `CORS_ORIGINS=https://your-frontend-domain.vercel.app`

Optional:
- `REDIS_URL=<managed redis url>`
- `GOOGLE_CLIENT_ID=<google oauth id>`
- `GOOGLE_CLIENT_SECRET=<google oauth secret>`
- `GOOGLE_CALLBACK_URL=https://your-backend-service.onrender.com/api/auth/google/callback`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_SECURE`
- `CACHE_VERY_SHORT_TTL`, `CACHE_SHORT_TTL`, `CACHE_MEDIUM_TTL`, `CACHE_LONG_TTL`, `CACHE_VERY_LONG_TTL`

### Frontend (Vercel)
Set this in Vercel project: **Settings > Environment Variables**.

- `NEXT_PUBLIC_API_URL=https://your-backend-service.onrender.com/api`

Optional compatibility alias:
- `VITE_API_BASE_URL=https://your-backend-service.onrender.com/api`

## 2) Schema Policy (Important)

- Direct `drizzle-kit push --force` is allowed only for first deploy on empty/throwaway DB.
- All subsequent schema changes must be migration-based (`generate` + `migrate`).
- `npm run db:deploy` enforces this automatically:
	- empty DB -> guarded first-deploy push + baseline
	- non-empty DB -> `drizzle-kit migrate`

## 3) Neon Database Setup

1. Create a Neon project and database.
2. Copy Neon pooled connection string and use it as backend `DATABASE_URL` on Render.
3. Optional manual bootstrap path: run `backend/schema.sql` (and `backend/seed.sql`) in Neon SQL Editor.
4. Recommended path: let Render run `npm run db:deploy` during build.

## 4) Deploy Backend to Render

1. In Render dashboard: **New + > Web Service**.
2. Connect your Git repository.
3. Configure:
- Root Directory: `backend`
- Runtime: `Node`
- Build Command: `npm ci && npm run db:deploy && npm run build`
- Start Command: `npm run start`
   
Optional shortcut:
- Use Render Blueprint with `render.yaml` at repository root (imports build/start/env defaults automatically).
4. Add all backend environment variables listed above.
5. Deploy.
6. Verify health endpoint:
- `GET https://your-backend-service.onrender.com/health`
- Expected response body: `OK`

## 5) Deploy Frontend to Vercel

1. In Vercel: **Add New Project**.
2. Import the same repository.
3. Configure:
- Root Directory: `frontend`
- Framework preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`
4. Add environment variable:
- `NEXT_PUBLIC_API_URL=https://your-backend-service.onrender.com/api`
5. Deploy.

`frontend/vercel.json` is included to ensure SPA route rewrites to `index.html`.

## 6) Connect Everything

After frontend deploy URL is final:

1. Update Render backend variables:
- `FRONTEND_URL=<actual vercel url>`
- `CORS_ORIGINS=<actual vercel url>`
2. If using Google OAuth, set:
- `GOOGLE_CALLBACK_URL=https://your-backend-service.onrender.com/api/auth/google/callback`
3. If OAuth provider has allowed redirect URIs, add the callback URL there too.
4. Redeploy backend service on Render.
5. Redeploy frontend on Vercel (if API URL changed).

## 7) Production Commands Summary

### Backend
- Build: `npm --prefix backend run build`
- Start: `npm --prefix backend run start`
- First deploy (empty DB): `npm --prefix backend run db:push:first-deploy`
- Subsequent deploys: `npm --prefix backend run db:migrate`
- Unified deploy-safe schema sync: `npm --prefix backend run db:deploy`

Migration authoring commands:
- Generate migration: `npm --prefix backend run db:generate`
- Apply migration: `npm --prefix backend run db:migrate`

### Frontend
- Build: `npm --prefix frontend run build`

## 8) Common Deployment Errors and Fixes

### Error: `CORS origin blocked`
Cause:
- Frontend URL not included in backend allowlist.
Fix:
- Set backend `CORS_ORIGINS=https://<your-vercel-domain>` and redeploy backend.

### Error: Database SSL / connection timeout to Neon
Cause:
- SSL flags not set for Neon.
Fix:
- Ensure `DATABASE_SSL=true` and `DATABASE_SSL_REJECT_UNAUTHORIZED=false`.
- Confirm `DATABASE_URL` uses Neon pooled host.

### Error: Frontend calls wrong API URL (404/NetworkError)
Cause:
- Missing or wrong frontend env var.
Fix:
- Set `NEXT_PUBLIC_API_URL=https://<render-backend>/api` in Vercel.
- Redeploy frontend.

### Error: Render deploy succeeds but service crashes on boot
Cause:
- Missing required backend env vars (`DATABASE_URL`, `JWT_SECRET`, `SESSION_SECRET` in production).
Fix:
- Add missing vars in Render and redeploy.

### Error: `relation already exists` during migrations
Cause:
- First deployment was done with push and migration metadata baseline is missing.
Fix:
- Run `npm --prefix backend run db:deploy` once against that DB to baseline then migrate.

### Error: OAuth redirect mismatch
Cause:
- Callback URL mismatch between backend env and Google console.
Fix:
- Set identical URL in `GOOGLE_CALLBACK_URL` and provider redirect config.

### Error: Deep-link route on frontend returns 404
Cause:
- SPA rewrite missing.
Fix:
- Keep `frontend/vercel.json` rewrite rule and redeploy.

## 9) Pre-Go-Live Checklist

- Backend `/health` returns `OK`.
- Frontend loads and can reach API.
- Login flow works (including OAuth if enabled).
- CORS errors absent in browser console.
- Neon DB has schema created from `backend/schema.sql`.
- Secrets are strong and not committed.
