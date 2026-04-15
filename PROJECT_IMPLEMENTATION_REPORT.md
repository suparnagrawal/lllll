# Universal Room Allocation System - Implementation Report (Code-Verified)

Audit date: 2026-04-15
Scope: full repository analysis, architecture verification, and runtime/build checks

---

## 1. Executive Summary

The project is a production-oriented full-stack room allocation platform for IIT Jodhpur with:

- modular Express + TypeScript backend
- React + Vite frontend with route-level and API-level access control
- PostgreSQL + Drizzle ORM persistence
- Redis-backed (with graceful in-memory fallback) rate limiting and cache helpers
- timetable import and staged commit workflows with freeze and conflict resolution

This report replaces older status-log style content and reflects only the implementation currently present in this repository.

---

## 2. Analysis Method

The report is based on direct inspection of:

- backend bootstrap and module registry
- all active module routers
- database schema and migrations
- frontend providers, routes, auth/session, API clients, and timetable pages
- container and compose deployment artifacts
- current automated test and build runs

Validation commands were executed in this workspace and results are summarized in Section 8.

---

## 3. Current System Architecture

### 3.1 Backend Runtime Architecture

Backend entrypoint: `backend/src/server.ts`

Startup and middleware order (verified):

1. Environment load (`import "./config/env"`)
2. Session store (`express-session` + `connect-pg-simple` table `user_sessions`)
3. Passport init/session restore
4. JSON parser
5. Performance middleware
6. Request logger middleware
7. Internal-operation marker
8. API rate limiters (`/api` general, `/api/auth` auth)
9. Feature module registration (`/api/<basePath>`)
10. Health routes (`/health`)
11. Global error handler

### 3.2 Module Registry Pattern

Feature mounting is centralized in `backend/src/modules/index.ts` and `backend/src/modules/registerModules.ts`.

Active registered modules (11):

- auth
- buildings
- rooms
- bookings
- bookingRequests
- bookingEditRequests
- availability
- users
- notifications
- timetable
- dashboard

Important implementation note:

- `backend/src/modules/holidays` exists but is not registered in `apiModules`; it is currently dormant at runtime.

### 3.3 API Surface Inventory (Measured)

Measured route declarations in backend route files: **111**

Breakdown by route file:

| Route file | Declarations |
|---|---:|
| `backend/src/modules/timetable/routes.ts` | 42 |
| `backend/src/modules/users/api/router.ts` | 15 |
| `backend/src/modules/auth/api/router.ts` | 10 |
| `backend/src/modules/rooms/api/router.ts` | 8 |
| `backend/src/modules/bookings/api/router.ts` | 8 |
| `backend/src/modules/bookingRequests/api/router.ts` | 8 |
| `backend/src/modules/buildings/api/router.ts` | 6 |
| `backend/src/modules/dashboard/api/router.ts` | 4 |
| `backend/src/modules/notifications/api/router.ts` | 3 |
| `backend/src/modules/bookingEditRequests/api/router.ts` | 3 |
| `backend/src/api/routes/health.routes.ts` | 3 |
| `backend/src/modules/availability/api/router.ts` | 1 |

---

## 4. Backend Domain and Workflow Analysis

### 4.1 Authentication and Authorization

Implementation files:

- `backend/src/auth/jwt.ts`
- `backend/src/auth/passport.ts`
- `backend/src/modules/auth/api/router.ts`
- `backend/src/middleware/auth.ts`
- `backend/src/middleware/rbac.ts`

Verified behavior:

- JWT access token: 15 minutes
- JWT refresh token: 7 days
- setup token: 15 minutes
- roles: `ADMIN`, `STAFF`, `FACULTY`, `STUDENT`, `PENDING_ROLE`
- Google OAuth restricted to `@iitj.ac.in`
- OAuth endpoints degrade to `503` when OAuth env vars are missing
- `POST /api/auth/complete-setup` currently enforces student-only setup completion

### 4.2 Booking and Request Lifecycle

Implementation files:

- `backend/src/modules/bookings/api/router.ts`
- `backend/src/modules/bookings/services/bookingService.ts`
- `backend/src/modules/bookingRequests/api/router.ts`
- `backend/src/modules/bookingEditRequests/api/router.ts`
- `backend/src/services/editBookingService.ts`

Key behavior verified:

- overlap detection uses standard interval test: `existing.start < new.end AND existing.end > new.start`
- booking create/update/delete routes are role-restricted and freeze-guarded
- approval flow for booking requests is staff-driven (`/booking-requests/:id/approve`)
- booking change flow supports:
  - direct updates for eligible pending-faculty requests
  - creation of new change request when direct change is not allowed
- unified booking edit endpoints are active:
  - `POST /api/bookings/:id/edit`
  - `GET /api/booking-edit-requests`
  - `POST /api/booking-edit-requests/:id/approve`
  - `POST /api/booking-edit-requests/:id/reject`

### 4.3 Booking Freeze and Concurrency Control

Implementation files:

- `backend/src/middleware/bookingFreeze.ts`
- `backend/src/modules/timetable/services/bookingFreezeService.ts`

Verified behavior:

- freeze blocks mutable booking operations with HTTP `423 Locked`
- response includes freeze holder metadata (`batchId`, user, timestamp)
- freeze state is in-memory (resets on server restart)
- only one freeze holder can exist at a time
- unfreeze ownership checks are enforced unless forced

### 4.4 Timetable Pipeline and Commit Engine

Implementation files:

- `backend/src/modules/timetable/routes.ts`
- `backend/src/modules/timetable/importService.ts`
- `backend/src/modules/timetable/timetableCommitEngine.ts`
- `backend/src/modules/timetable/changeService.ts`
- `backend/src/modules/timetable/service.ts`

Verified capabilities:

- slot system CRUD, day/lane, time-band, block management
- preview/import/decision/reallocate/commit flows
- conflict-aware commit endpoints (`detect-conflicts`, `commit-with-resolutions`, `cancel-commit`)
- staged commit session pipeline:
  - `commit/start`
  - `commit/external-check` and `external-resolve`
  - `commit/internal-check` and `internal-resolve`
  - `commit/freeze`
  - `commit/runtime-check` and `runtime-resolve`
  - `commit/finalize`, `commit/cancel`, `commit/:id/status`
- edit-mode commit start endpoint: `POST /api/timetable/edit/start`
- slot systems lock after commit via `lockSlotSystem(...)`
- locked slot systems require change-workspace flow for structural edits
- one-batch-per-slot-system retention behavior is implemented in preview flow

### 4.5 Rate Limiting and Resilience

Implementation files:

- `backend/src/api/middleware/rateLimit.middleware.ts`
- `backend/src/data/cache/redis.client.ts`

Verified current limits:

- general API: 300 requests / 15 min
- auth: 20 requests / 5 min
- upload: 10 requests / 1 hour
- timetable import read: 120 / 15 min
- timetable import preview: 10 / 1 hour
- timetable import mutation: 45 / 15 min
- timetable import commit: 30 / 15 min

Resilience behavior:

- uses Redis store when available
- gracefully falls back to memory store when Redis is unavailable

---

## 5. Database and Migration Analysis

### 5.1 Table Inventory (Measured)

Measured table definitions (`pgTable`) in:

- `backend/src/db/schema.ts`
- `backend/src/modules/timetable/schema.ts`

Total: **22 tables**

Domain grouping:

- Core room system: `buildings`, `rooms`, `bookings`
- Booking workflows: `booking_requests`, `booking_edit_requests`, `notifications`
- Timetable import core: `timetable_import_batches`, `timetable_import_rows`, `timetable_import_occurrences`, `timetable_import_row_resolutions`, `commit_sessions`
- Timetable structure: `slot_systems`, `slot_days`, `slot_time_bands`, `slot_blocks`
- Users and access: `users`, `staff_building_assignments`, `user_sessions`
- Academic model: `courses`, `course_faculty`, `course_enrollments`, `booking_course_link`

### 5.2 Migration Inventory (Measured)

- SQL migration files in `backend/drizzle`: **32**
- journal entries in `backend/drizzle/meta/_journal.json`: **28**

Interpretation:

- repository contains additional SQL files beyond journaled sequence (expected in iterative schema workflows)
- effective migration order should be taken from the journal

---

## 6. Frontend Architecture Analysis

### 6.1 Application Composition

Entry point: `frontend/src/main.tsx`

Provider stack (verified):

1. `QueryClientProvider`
2. `AuthProvider`
3. `ToastProvider`
4. `RouterProvider`
5. `ReactQueryDevtools` in dev only

### 6.2 Routing Model

Routing file: `frontend/src/routes/index.tsx`

Top-level behavior:

- all application routes are nested under `ProtectedRoute`
- admin-only sections use `RequireRole(['ADMIN'])`
- timetable has nested admin subroutes:
  - `/timetable`
  - `/timetable/structure`
  - `/timetable/imports`
  - `/timetable/processed`
  - `/timetable/workspace`
- public routes:
  - `/login`
  - `/auth/callback`
  - `/auth/setup`

Profile setup gate:

- `/profile/setup` is controlled by a per-user local marker via `frontend/src/auth/profileSetup.ts`

### 6.3 Session and Auth UX

Auth context file: `frontend/src/auth/AuthContext.tsx`

Verified behavior:

- token refresh check every 5 minutes
- inactivity warning at 30 minutes
- auto logout at 35 minutes inactivity
- unauthorized callback wiring through API client
- pending-role users redirected away from protected app routes

### 6.4 Frontend API and Caching Strategy

API layer files:

- `frontend/src/lib/api/client.ts`
- `frontend/src/lib/api/*.ts`

Verified behavior:

- `API_BASE_URL` defaults to `/api` with `VITE_API_BASE_URL` override
- automatic refresh-token retry on eligible 401 responses
- normalized client error formatting

React Query volatility tiers (`frontend/src/lib/queryConfig.ts`):

- very volatile: stale 1 min, gc 3 min
- volatile: stale 5 min, gc 10 min
- stable: stale 10 min, gc 20 min
- static: stale 30 min, gc 60 min

### 6.5 Timetable Frontend Integration

Key file: `frontend/src/lib/api/slots.ts`

Frontend is wired for both:

- direct import/commit operations
- staged commit session operations (external/internal/runtime checks and resolutions)
- change-workspace preview/apply operations

This aligns with the current backend timetable API surface.

---

## 7. Infrastructure and Deployment Analysis

### 7.1 Compose Topology

`docker-compose.yml` currently defines:

- `db` (PostgreSQL 17)
- `redis` (Redis 7)
- `backend-schema-sync` (one-shot schema push stage)
- `backend` (Node runtime)
- `frontend` (Nginx static serve + proxy)

### 7.2 Container Build Strategy

Backend Dockerfile stages:

- deps
- builder
- migrator
- runner

Frontend Dockerfile stages:

- builder
- nginx runtime

Nginx proxy (`frontend/nginx.conf`) routes `/api/*` to `http://backend:5000/api/*` and serves SPA fallback with `try_files`.

---

## 8. Runtime and Build Validation Snapshot

All checks below were executed in this workspace during this audit.

| Check | Command | Result |
|---|---|---|
| Backend tests | `DATABASE_URL=... JWT_SECRET=... SESSION_SECRET=... npm --prefix backend test` | Pass: 6 files, 38 tests |
| Frontend tests | `npm --prefix frontend test` | Pass: 3 files, 16 tests |
| Backend build | `npm --prefix backend run build` | Pass |
| Frontend build | `npm --prefix frontend run build --silent` | Pass (`vite` production build succeeded) |
| Compose config | `docker-compose -f docker-compose.yml config` | Pass (executed via podman compose provider wrapper) |

Additional test output note:

- frontend tests emit React Router v7 future-flag warnings; these are warnings, not failures.

---

## 9. Codebase Observations and Risks

### 9.1 Dormant or Unwired Code Paths

- `backend/src/modules/holidays` exists but is not mounted in active module registry.
- top-level `data/repositories/*` appears present but is not referenced by current runtime wiring.

### 9.2 Operational Risk

- booking freeze state is in-memory only; a process restart clears freeze state.

### 9.3 API Contract Consistency

- response payload keys vary across modules (`message` vs `error` object styles), which increases frontend error-shape branching.

### 9.4 Test Scope

- current automated suite is focused and passing, but there is no full end-to-end workflow coverage (especially for multi-stage timetable commit sessions).

---

## 10. Recommended Next Improvements

1. Persist freeze state in Redis or DB-backed lease model to survive restarts.
2. Decide whether to activate or remove dormant `holidays` module to reduce drift.
3. Remove or integrate unused top-level repository layer under `data/repositories`.
4. Standardize API error envelope shape across all modules.
5. Add end-to-end tests for:
   - timetable staged commit (all conflict stages)
   - freeze acquisition/release edge cases
   - booking request change paths

---

## 11. Final Status

Current implementation is coherent, modular, and deployable, with validated test/build pipelines and an advanced timetable commit architecture. The highest-value follow-up work is around operational hardening (freeze persistence), contract consistency, and e2e coverage depth.