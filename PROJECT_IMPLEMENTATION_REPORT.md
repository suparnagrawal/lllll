# Universal Room Allocation System - Implementation Report

## Executive Summary

This is a **full-stack web application** for managing university room bookings and timetable allocations at IIT Jodhpur. The system handles room reservations, booking requests with approval workflows, timetable imports from Excel files, and role-based access control.

| Component | Technology Stack |
|-----------|------------------|
| **Backend** | Node.js + Express + TypeScript |
| **Frontend** | React + Vite + TypeScript |
| **Database** | PostgreSQL (via Drizzle ORM) |
| **Cache** | Redis |
| **Authentication** | JWT + Google OAuth 2.0 |
| **Infrastructure** | Docker Compose |

---

## 1. PROJECT STRUCTURE

```
/home/suparn/software/
├── backend/                    # Node.js/Express API server
│   ├── src/
│   │   ├── server.ts           # Express entry point
│   │   ├── api/                # Controllers, routes, middleware
│   │   ├── auth/               # JWT + OAuth authentication
│   │   ├── config/             # Environment configuration
│   │   ├── db/                 # Database schema (Drizzle ORM)
│   │   ├── data/               # Cache, queries, repositories
│   │   ├── domain/             # Business logic services
│   │   ├── middleware/         # Global middleware
│   │   ├── modules/            # Feature modules (timetable)
│   │   ├── routes/             # Express route definitions
│   │   └── shared/             # Utilities, validators, types
│   └── drizzle/                # Database migrations (24 files)
│
├── frontend/                   # React SPA
│   ├── src/
│   │   ├── main.tsx            # React entry point
│   │   ├── App.tsx             # Root component with providers
│   │   ├── api/                # API client modules
│   │   ├── auth/               # Authentication context
│   │   ├── components/         # UI components (shadcn/ui)
│   │   ├── pages/              # Page components
│   │   ├── routes/             # React Router configuration
│   │   ├── hooks/              # Custom React hooks
│   │   ├── lib/                # Utilities & API clients
│   │   └── context/            # React context providers
│   └── public/                 # Static assets
│
├── shared/                     # Code shared between FE/BE
│   ├── utils/                  # Logger, pagination, response utils
│   └── validators/             # Zod validation schemas
│
├── docs/                       # Project documentation
├── docker-compose.yml          # PostgreSQL + Redis containers
└── HOW_TO_RUN.md               # Setup instructions
```

---

## 2. DATABASE SCHEMA

**ORM**: Drizzle ORM  
**Location**: `/backend/src/db/schema.ts`

### Core Tables

#### Users & Access Control
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `users` | User accounts | id, name, email, passwordHash, role (ADMIN/STAFF/FACULTY/STUDENT/PENDING_ROLE), googleId, department, isActive |
| `user_sessions` | OAuth session store | sid, sess, expire |
| `staff_building_assignments` | Staff-to-building mapping | staffId, buildingId, assignedBy |

#### Buildings & Rooms
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `buildings` | Physical locations | id, name, description, location, managedByStaffId |
| `rooms` | Classrooms/spaces | id, name, buildingId, capacity, roomType (enum), hasProjector, hasMic, accessible |

**Room Types**: LECTURE_HALL, CLASSROOM, SEMINAR_ROOM, COMPUTER_LAB, CONFERENCE_ROOM, AUDITORIUM, WORKSHOP, OTHER

#### Bookings & Requests
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `bookings` | Confirmed room reservations | id, roomId, startAt, endAt, requestId, approvedBy, source (MANUAL_REQUEST/TIMETABLE_ALLOCATION/SLOT_CHANGE/VENUE_CHANGE) |
| `booking_requests` | Pending booking requests | id, userId, roomId, startAt, endAt, eventType, purpose, status (PENDING_FACULTY/PENDING_STAFF/APPROVED/REJECTED/CANCELLED) |

**Event Types**: QUIZ, SEMINAR, SPEAKER_SESSION, MEETING, CULTURAL_EVENT, WORKSHOP, CLASS, OTHER

#### Change Requests
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `slot_change_requests` | Request to change timetable slot | id, courseId, currentBookingId, proposedStart, proposedEnd, status |
| `venue_change_requests` | Request to change room | id, courseId, currentBookingId, proposedRoomId, status |

#### Courses & Enrollments
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `courses` | Academic courses | id, code, name, department, credits |
| `course_faculty` | Faculty teaching courses | courseId, facultyId |
| `course_enrollments` | Student enrollments | courseId, studentId |
| `booking_course_link` | Links bookings to courses | bookingId, courseId |

#### Timetable Import Pipeline
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `slot_systems` | Academic slot structure | id, name |
| `slot_days` | Days in slot system | id, slotSystemId, dayOfWeek |
| `slot_time_bands` | Time periods | id, startTime, endTime |
| `slot_blocks` | Label-based slot groupings | id, dayId, startBandId, label |
| `timetable_import_batches` | Upload batches | id, batchKey, slotSystemId, termStartDate, termEndDate, status |
| `timetable_import_rows` | Parsed import rows | id, batchId, rawRow, classification, resolvedRoomId |
| `timetable_import_occurrences` | Generated booking instances | id, rowId, roomId, startAt, endAt, bookingId, status |

#### Notifications
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `notifications` | System notifications | notificationId, recipientId, subject, message, type, isRead |

**Notification Types**: BOOKING_REQUEST_CREATED/FORWARDED/APPROVED/REJECTED/CANCELLED, SLOT_CHANGE_*, VENUE_CHANGE_*

---

## 3. API ENDPOINTS

**Base URL**: `http://localhost:5000/api`

### Authentication (`/auth` or `/api/auth`)
| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| POST | `/auth/login` | Email/password login | None |
| GET | `/auth/google` | Initiate Google OAuth | None |
| GET | `/auth/google/callback` | OAuth callback | None |
| POST | `/auth/complete-setup` | Complete first-time setup | Setup token |
| POST | `/auth/refresh` | Refresh tokens | Refresh token |
| GET | `/auth/me` | Get current user | JWT |

### Buildings (`/api/buildings`)
| Method | Endpoint | Purpose | Roles |
|--------|----------|---------|-------|
| GET | `/` | List all buildings | All authenticated |
| GET | `/:id` | Get building details | All authenticated |
| GET | `/:id/rooms` | Get rooms in building | All authenticated |
| POST | `/` | Create building | ADMIN |
| PATCH | `/:id` | Update building | ADMIN, STAFF |
| DELETE | `/:id` | Delete building | ADMIN, STAFF |

### Rooms (`/api/rooms`)
| Method | Endpoint | Purpose | Roles |
|--------|----------|---------|-------|
| GET | `/` | List rooms with filters | All authenticated |
| GET | `/:id` | Get room details | All authenticated |
| POST | `/` | Create room | ADMIN, STAFF |
| PATCH | `/:id` | Update room | ADMIN, STAFF |
| DELETE | `/:id` | Delete room | ADMIN, STAFF |

### Bookings (`/api/bookings`)
| Method | Endpoint | Purpose | Roles |
|--------|----------|---------|-------|
| GET | `/` | List bookings | All (STAFF filtered by assigned buildings) |
| GET | `/:id` | Get booking details | All authenticated |
| POST | `/` | Create booking | ADMIN, STAFF |
| POST | `/bulk` | Bulk create bookings | ADMIN, STAFF |
| PATCH | `/:id` | Update booking | ADMIN, STAFF |
| DELETE | `/:id` | Delete booking | ADMIN, STAFF |
| DELETE | `/prune` | Prune bookings by date range | ADMIN |

### Booking Requests (`/api/booking-requests`)
| Method | Endpoint | Purpose | Roles |
|--------|----------|---------|-------|
| GET | `/` | List requests | All authenticated |
| GET | `/:id` | Get request details | All authenticated |
| POST | `/` | Submit booking request | STUDENT, FACULTY |
| POST | `/:id/forward` | Forward request to staff queue | FACULTY |
| POST | `/:id/approve` | Approve request and create booking | STAFF |
| POST | `/:id/reject` | Reject request | FACULTY, STAFF |
| POST | `/:id/cancel` | Cancel pending request | Owner, ADMIN |

### Change Requests
**Slot Changes** (`/api/slot-change-requests`):
| Method | Endpoint | Purpose | Roles |
|--------|----------|---------|-------|
| GET | `/` | List slot change requests | All authenticated |
| GET | `/:id` | Get slot change request details | All authenticated |
| POST | `/` | Request slot change | FACULTY |
| POST | `/:id/approve` | Approve change | STAFF, ADMIN |
| POST | `/:id/reject` | Reject change | STAFF, ADMIN |
| POST | `/:id/cancel` | Cancel own pending request | FACULTY |

**Venue Changes** (`/api/venue-change-requests`):
| Method | Endpoint | Purpose | Roles |
|--------|----------|---------|-------|
| GET | `/` | List venue change requests | All authenticated |
| GET | `/:id` | Get venue change request details | All authenticated |
| POST | `/` | Request venue change | FACULTY |
| POST | `/:id/approve` | Approve change | STAFF, ADMIN |
| POST | `/:id/reject` | Reject change | STAFF, ADMIN |
| POST | `/:id/cancel` | Cancel own pending request | FACULTY |

### Availability (`/api/availability`)
| Method | Endpoint | Purpose | Roles |
|--------|----------|---------|-------|
| GET | `/` | Query available time slots | All authenticated |

### Timetable (`/api/timetable`) - ADMIN Only
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/slot-systems` | Create slot system |
| GET | `/slot-systems` | List slot systems (includes `isLocked`) |
| DELETE | `/slot-systems/:id` | Delete slot system |
| GET | `/slot-systems/:id/full` | Full grid view |
| POST | `/slot-systems/:id/preview-changes` | Preview structural changes |
| POST | `/slot-systems/:id/apply-changes` | Apply changes (freeze + mutate) |
| POST | `/days` | Create day (blocked if locked) |
| GET | `/days` | List days |
| DELETE | `/days/:id` | Delete day (blocked if locked) |
| POST | `/days/:id/lanes` | Add lane to a day |
| DELETE | `/days/:id/lanes` | Remove lane from a day |
| POST | `/time-bands` | Create time band (blocked if locked) |
| GET | `/time-bands` | List time bands |
| PATCH | `/time-bands/:id` | Update time band (blocked if locked) |
| DELETE | `/time-bands/:id` | Delete time band (blocked if locked) |
| POST | `/blocks` | Create block (blocked if locked) |
| DELETE | `/blocks/:id` | Delete block (blocked if locked) |
| GET | `/imports` | List import batches |
| POST | `/imports/preview` | Preview Excel import |
| GET | `/imports/:id` | Get import batch details |
| PUT | `/imports/:id/decisions` | Save row-level decisions |
| POST | `/imports/:id/rows/:rowId/transfer` | Transfer a row to another batch/system |
| POST | `/imports/:id/reallocate` | Re-run allocation for unresolved rows |
| POST | `/imports/:id/commit` | Commit import |
| DELETE | `/imports/:id` | Delete import batch |
| GET | `/imports/:id/processed-rows` | Get processed rows with outcomes |
| POST | `/imports/:id/detect-conflicts` | Detect booking conflicts |
| POST | `/imports/:id/commit-with-resolutions` | Commit with conflict resolutions |
| POST | `/imports/:id/cancel-commit` | Cancel commit, release freeze |
| GET | `/imports/:id/freeze-status` | Check booking freeze state |

### Users (`/api/users`)
| Method | Endpoint | Purpose | Roles |
|--------|----------|---------|-------|
| GET | `/faculty` | List active faculty users | All authenticated |
| GET | `/profile` | Get current user profile | All authenticated |
| PATCH | `/profile` | Update current user profile | All authenticated |
| DELETE | `/profile` | Delete own account (anonymize + deactivate) | All authenticated |
| GET | `/profile/export` | Export own user data | All authenticated |
| GET | `/:id/building-assignments` | View staff building assignments | ADMIN, STAFF (self for STAFF) |
| GET | `/` | List users (paginated + filters) | ADMIN |
| POST | `/` | Create user | ADMIN |
| PATCH | `/:id/role` | Update user role | ADMIN |
| PUT | `/:id/building-assignments` | Set staff building assignments | ADMIN |
| PATCH | `/:id/active` | Activate/deactivate user | ADMIN |
| DELETE | `/:id` | Delete user (anonymized soft delete) | ADMIN |

### Notifications (`/api/notifications`)
| Method | Endpoint | Purpose | Roles |
|--------|----------|---------|-------|
| GET | `/` | List notifications (includes `unreadCount`) | Owner |
| POST | `/:id/read` | Mark one notification as read | Owner |
| POST | `/read-all` | Mark all notifications as read | Owner |

### Dashboard (`/api/dashboard`)
| Method | Endpoint | Purpose | Roles |
|--------|----------|---------|-------|
| GET | `/data` | Combined payload: stats + upcoming bookings + activity feed | All authenticated |
| GET | `/stats` | Aggregated statistics | All authenticated |
| GET | `/upcoming-bookings` | Next upcoming bookings | All authenticated |
| GET | `/activity-feed` | Recent activity feed | All authenticated |

### Health (`/health`)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/` | Basic liveness |
| GET | `/ready` | Readiness (DB + Redis) |
| GET | `/live` | Kubernetes liveness |

---

## 4. AUTHENTICATION SYSTEM

**Location**: `/backend/src/auth/`

### JWT Token System (`jwt.ts`)
| Token Type | TTL | Purpose |
|------------|-----|---------|
| Access Token | 15 min | API requests (Bearer header) |
| Refresh Token | 7 days | Obtain new access tokens |
| Setup Token | 15 min | Complete account setup (new users) |

**Payload Structure**:
```typescript
{
  id: number,
  role: "ADMIN" | "STAFF" | "FACULTY" | "STUDENT" | "PENDING_ROLE",
  type: "access" | "refresh" | "setup"
}
```

### Google OAuth (`passport.ts`)
- **Provider**: `passport-google-oauth20`
- **Domain Restriction**: Only `@iitj.ac.in` emails allowed
- **Flow**: Google consent → callback → user lookup/create → issue tokens
- **Session Storage**: PostgreSQL via `connect-pg-simple`

### Middleware Stack
1. **authMiddleware**: Validates Bearer token, attaches `req.user`
2. **requireRole(roles)**: RBAC enforcement (returns 403 if unauthorized)

---

## 5. BUSINESS LOGIC SERVICES

**Location**: `/backend/src/services/`

### Booking Service (`bookingService.ts`)
| Function | Purpose |
|----------|---------|
| `createBooking()` | Create with overlap validation |
| `createBookingsBulk()` | Batch create with per-item error handling |
| `updateBooking()` | Update with overlap re-validation |
| `hasBookingOverlap()` | Detect time conflicts |
| `deleteBooking()` | Cascade-friendly deletion |

**Overlap Detection**: `start1 < end2 AND end1 > start2`

### Notification Service (`notificationService.ts`)
| Function | Purpose |
|----------|---------|
| `sendRoleAwareNotifications()` | Create DB records + send emails |
| `getActiveAdminIds()` | Query admin users |
| `getActiveStaffIdsForBuilding()` | Query assigned staff |

**Email**: Nodemailer with SMTP (optional, configurable)

### Slot/Venue Change Services
| Service | Purpose |
|---------|---------|
| `slotChangeService.ts` | Validate & apply timetable slot changes |
| `venueChangeService.ts` | Validate & apply room changes |

### Booking Freeze Service (`bookingFreezeService.ts`)
- **Purpose**: Lock booking mutations during timetable import commits
- **State**: In-memory (resets on server restart)
- **Response**: HTTP 423 Locked when frozen

---

## 6. MIDDLEWARE

**Location**: `/backend/src/middleware/`

### Global Middleware (in order)
1. **Session Management**: `express-session` + `connect-pg-simple`
2. **Passport OAuth**: Initialize + restore session
3. **JSON Parser**: `express.json()`
4. **Performance Tracking**: Request duration metrics
5. **Request Logging**: Method, path, user ID, response time
6. **Rate Limiting**: Redis-backed limits per endpoint type

### Rate Limits
| Limiter | Limit | Window |
|---------|-------|--------|
| General | 100 requests | 15 min |
| Auth | 5 requests | 3 min |
| Upload | 10 requests | 1 hour |
| Timetable Import | 45 mutations | 15 min |

### Request Validation
- **Framework**: Zod
- **Middleware**: `validate(schema)` for params/query/body
- **Schemas Location**: `/backend/src/shared/validators/schemas/`

---

## 7. FRONTEND ARCHITECTURE

### Page Components

**Location**: `/frontend/src/pages/`

| Page | Route | Purpose | Access |
|------|-------|---------|--------|
| `DashboardPage` | `/` | Overview stats & recent activity | All authenticated |
| `AvailabilityPage` | `/availability` | Room availability calendar | All authenticated |
| `RoomsPage` | `/rooms` | Room management CRUD | All authenticated |
| `BookingsPage` | `/bookings` | Direct booking management | ADMIN, STAFF |
| `BookingRequestsPage` | `/requests` | Booking request workflow | All authenticated |
| `UsersPage` | `/users` | User management | ADMIN |
| `TimetableBuilderPage` | `/timetable` | Slot system & import | ADMIN |
| `ProfilePage` | `/profile` | User profile | All authenticated |
| `LoginPage` | `/login` | Authentication | Public |
| `AuthCallbackPage` | `/auth/callback` | OAuth redirect handler | Public |
| `AuthSetupPage` | `/auth/setup` | First-time role setup | PENDING_ROLE |

### Component Library (shadcn/ui)

**Location**: `/frontend/src/components/ui/`

| Component | File | Purpose |
|-----------|------|---------|
| Button | `button.tsx` | Action buttons with variants |
| Card | `card.tsx` | Content containers |
| Dialog | `dialog.tsx` | Modal dialogs |
| Form | `form.tsx` | React Hook Form integration |
| Input | `input.tsx` | Text inputs |
| Select | `select.tsx` | Dropdown selects |
| Table | `table.tsx` | Data tables |
| Toast | `toast.tsx` | Notifications |
| Tabs | `tabs.tsx` | Tabbed interfaces |
| Badge | `badge.tsx` | Status indicators |
| Calendar | `calendar.tsx` | Date picker |
| Skeleton | `skeleton.tsx` | Loading states |
| Popover | `popover.tsx` | Floating content |
| DropdownMenu | `dropdown-menu.tsx` | Action menus |

### State Management

| Layer | Technology | Purpose |
|-------|------------|---------|
| Server State | TanStack React Query | Data fetching, caching, mutations |
| Auth State | React Context | User, login, logout, tokens |
| UI State | React useState | Local component state |
| Notifications | Toast Context | User feedback |

### Query Configuration

| Data Type | Stale Time | GC Time | Examples |
|-----------|------------|---------|----------|
| Very Volatile | 1 min | 3 min | Availability |
| Volatile | 5 min | 10 min | Bookings, requests |
| Stable | 10 min | 20 min | Buildings, users |
| Static | 30 min | 1 hour | Slot systems |

### Custom Hooks

**Location**: `/frontend/src/hooks/`

| Hook | Purpose |
|------|---------|
| `useBookings` | Fetch & mutate bookings |
| `useBookingRequests` | Fetch & mutate requests |
| `useRooms` | Fetch & mutate rooms |
| `useBuildings` | Fetch & mutate buildings |
| `useUsers` | Fetch & mutate users |
| `useAvailability` | Fetch room availability |
| `useSlotSystems` | Fetch & mutate slot systems |
| `useProfile` | Fetch & update profile |

### API Client

**Location**: `/frontend/src/lib/api/`

| File | Purpose |
|------|---------|
| `client.ts` | HTTP client with auth injection |
| `auth.ts` | Login, OAuth, setup |
| `bookings.ts` | Booking CRUD |
| `booking-requests.ts` | Request CRUD |
| `availability.ts` | Availability queries |
| `rooms.ts` | Room CRUD |
| `buildings.ts` | Building CRUD |
| `users.ts` | User management |
| `slots.ts` | Slot system & timetable import |
| `dashboard.ts` | Dashboard data |
| `notifications.ts` | Notification management |

---

## 8. ROUTING & NAVIGATION

**Location**: `/frontend/src/routes/index.tsx`

### Route Protection Levels

```
Level 1: ProtectedRoute
├─ Requires: user !== null
├─ Checks: user.role !== "PENDING_ROLE"
└─ Redirect: /login if not authenticated

Level 2: RequireRole
├─ Requires: user.role in allowed roles
└─ Shows: 403 page if unauthorized

Level 3: Page-level filtering
└─ Shows/hides UI based on role
```

### Route Structure
```typescript
/                    # Dashboard (all authenticated)
/availability        # Room availability (all authenticated)
/rooms               # Room management (all authenticated)
/profile             # User profile (all authenticated)
/bookings            # Direct bookings (ADMIN, STAFF)
/requests            # Booking requests (all authenticated)
/users               # User management (ADMIN)
/timetable           # Timetable builder (ADMIN)
/login               # Login page (public)
/auth/callback       # OAuth callback (public)
/auth/setup          # First-time setup (PENDING_ROLE)
```

---

## 9. SHARED CODE

**Location**: `/shared/`

### Utilities (`/shared/utils/`)

| File | Purpose |
|------|---------|
| `logger.ts` | Winston-based logging (JSON files + console) |
| `pagination.utils.ts` | Pagination helpers (DEFAULT_LIMIT=20, MAX_LIMIT=100) |
| `response.utils.ts` | Standardized API response envelope |

### Validators (`/shared/validators/schemas/`)

| File | Schemas |
|------|---------|
| `booking.schemas.ts` | createBookingSchema, updateBookingSchema, bulkCreateBookingSchema |
| `room.schemas.ts` | createRoomSchema, updateRoomSchema, roomAvailabilitySchema |
| `building.schemas.ts` | createBuildingSchema, updateBuildingSchema |

---

## 10. INFRASTRUCTURE

**Location**: `/docker-compose.yml`

### Services

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| PostgreSQL | `postgres:17-alpine` | 5433:5432 | Primary database |
| Redis | `redis:7-alpine` | 6379:6379 | Caching & rate limiting |

### Volumes
- `pgdata`: PostgreSQL data persistence
- `redisdata`: Redis data persistence

### Environment Variables (Backend)

| Variable | Purpose | Default |
|----------|---------|---------|
| `DATABASE_URL` | PostgreSQL connection | Required |
| `JWT_SECRET` | JWT signing key | Required |
| `PORT` | Server port | 5000 |
| `NODE_ENV` | Environment | development |
| `REDIS_URL` | Redis connection | redis://localhost:6379 |
| `FRONTEND_URL` | CORS origin | http://localhost:5173 |
| `GOOGLE_CLIENT_ID` | OAuth client ID | Optional |
| `GOOGLE_CLIENT_SECRET` | OAuth secret | Optional |
| `SMTP_*` | Email configuration | Optional |

---

## 11. KEY IMPLEMENTATION PATTERNS

### Backend Patterns

1. **Repository Pattern**: Data access abstracted through repositories
2. **Service Layer**: Business logic isolated from controllers
3. **Middleware Chain**: Authentication → Authorization → Validation → Handler
4. **Error Handling**: Custom AppError class with structured responses
5. **Caching Strategy**: Redis with tiered TTL by data volatility
6. **Rate Limiting**: Redis-backed with per-endpoint limits

### Frontend Patterns

1. **React Query**: Server state management with automatic caching
2. **Context Providers**: Auth state, toast notifications
3. **Custom Hooks**: Encapsulate data fetching logic
4. **shadcn/ui**: Consistent, accessible component library
5. **React Hook Form + Zod**: Form handling with schema validation
6. **Lazy Loading**: Code-split pages for performance

### Security Measures

1. **JWT Tokens**: Short-lived access (15 min), long-lived refresh (7 days)
2. **Domain Restriction**: Only @iitj.ac.in emails via Google OAuth
3. **Role-Based Access**: ADMIN, STAFF, FACULTY, STUDENT roles
4. **Rate Limiting**: Prevent brute force and abuse
5. **Input Validation**: Zod schemas on all inputs
6. **CORS**: Restricted to frontend origin

---

## 12. TIMETABLE IMPORT WORKFLOW

### Overview

The system supports bulk importing timetables from Excel files with a preview-review-commit workflow.

### Pipeline Steps

1. **Upload**: Admin uploads Excel file (`POST /api/timetable/imports/preview`)
2. **Parse**: System parses rows, normalizes course codes, classrooms, slots
3. **Classify**: Each row classified as:
   - `VALID_AND_AUTOMATABLE`: Ready for booking creation
   - `UNRESOLVED_SLOT`: Slot label not found in system
   - `UNRESOLVED_ROOM`: Room not found
   - `AMBIGUOUS_CLASSROOM`: Multiple room matches
   - `DUPLICATE_ROW`: Duplicate entry
   - `CONFLICTING_MAPPING`: Conflicts with existing bookings
   - `MISSING_REQUIRED_FIELD`: Required fields missing in a row
   - `OTHER_PROCESSING_ERROR`: Parser/normalization error in a row
4. **Review**: Admin reviews classifications, resolves issues
5. **Decisions**: Admin saves resolutions (`PUT /api/timetable/imports/:id/decisions`)
6. **Commit**: System creates bookings (`POST /api/timetable/imports/:id/commit`)
7. **Freeze**: Bookings frozen during commit to prevent conflicts

### Slot System Structure

```
SlotSystem (e.g., "IIT Jodhpur 2024-25")
├── Days (MON, TUE, WED, THU, FRI)
│   └── Lanes (parallel tracks per day)
├── TimeBands (08:00-09:00, 09:00-10:00, ...)
└── Blocks (labeled slots like "A1", "B2", etc.)
```

### Slot System Lifecycle

```
Created (isLocked=false) → First Import Committed → Locked (isLocked=true)
                                                         │
                                                         ▼
                                              Direct mutations blocked (403)
                                              Edits via Change Workspace only
```

- **Unlocked**: Days, time bands, and blocks can be freely added/removed.
- **Locked** (after first commit): Direct mutation endpoints return **HTTP 403**. Structural changes require the **Change Workspace** flow (`POST /api/timetable/slot-systems/:id/apply-changes`), which acquires a booking freeze, applies mutations, cleans up orphaned bookings, and releases the freeze.

### One-Batch-Per-System Rule

| Constraint | Behavior |
|------------|----------|
| Only one retained batch per slot system at preview time | Preview flow enumerates existing batches for the same slot system and removes redundant ones |
| Fingerprint reuse optimization | If a matching fingerprint batch exists, it is reused and other same-slot-system batches are deleted |
| New preview without fingerprint match | Existing same-slot-system batches are deleted before inserting the new PREVIEWED batch |
| Batch deletion side-effect | Deleting a committed batch deletes its linked bookings as part of batch cleanup |
| Slot system is locked after commit | `isLocked = true` set atomically on commit |

### Conflict-Aware Commit Flow

```
Admin clicks "Commit"
        │
        ▼
  detectCommitConflicts()
        │
   ┌────┴────┐
   │         │
No Conflicts  Conflicts Found
   │         │
   ▼         ▼
commitWith   Show Resolution Dialog
Resolutions  │
(empty [])   Admin chooses per-occurrence:
             │ ├─ FORCE_OVERWRITE (delete conflicting booking)
             │ ├─ SKIP (skip this occurrence)
             │ └─ ALTERNATIVE_ROOM (book in different room)
             │
             ▼
         commitWithResolutions(resolutions[])
             │
             ▼
         System locked, freeze released
```

#### Conflict Resolution Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/imports/:id/detect-conflicts` | Freeze bookings, detect overlapping bookings |
| POST | `/imports/:id/commit-with-resolutions` | Apply user resolutions and create bookings |
| POST | `/imports/:id/cancel-commit` | Release freeze without changes |
| GET | `/imports/:id/freeze-status` | Check freeze state for a batch |

#### Resolution Strategies

| Strategy | Behavior |
|----------|----------|
| `FORCE_OVERWRITE` | Deletes the conflicting existing booking, creates the new one |
| `SKIP` | Marks this occurrence as skipped, no booking created |
| `ALTERNATIVE_ROOM` | Attempts to book in a different room (requires `alternativeRoomId`) |

### Booking Freeze Behavior

- **Acquire**: `detectCommitConflicts` freezes booking mutations system-wide
- **Scope**: Blocks booking approvals, creates, updates, and deletes (requests still allowed)
- **Release**: Automatically on `commitWithResolutions` or `cancelCommit` (including error paths)
- **Error recovery**: All error paths call `unfreezeBookings` to ensure no dangling freeze
- **Idempotent**: Re-calling with same batchId succeeds; different batchId returns 409
- **UI indicator**: Red banner shown when freeze is active, with holder info

### Change Workspace

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/slot-systems/:id/preview-changes` | Preview impact of proposed changes |
| POST | `/slot-systems/:id/apply-changes` | Apply changes under booking freeze |

The Change Workspace supports:
- Adding/removing days, time bands, blocks, and lanes
- All mutations bypass the lock guard (`bypassLock = true`)
- Orphaned occurrences (referencing deleted blocks) are marked FAILED
- Associated bookings for orphaned occurrences are deleted
- Results include a recomputation summary with affected counts and warnings

### Backend Hardening

| Feature | Implementation |
|---------|---------------|
| **Idempotent commit** | `commitWithResolutions` skips occurrences already in CREATED/SKIPPED/FAILED status |
| **Transaction safety** | FORCE_OVERWRITE delete+create wrapped in transaction |
| **Dedup guard** | Occurrences with existing bookingId are skipped |
| **Lock on commit** | `lockSlotSystem()` called after both `commitTimetableImport` and `commitWithResolutions` |
| **Error freeze recovery** | All catch blocks call `unfreezeBookings` to prevent dangling freeze |

---

## 13. APPROVAL WORKFLOW

### Booking Request Flow

```
STUDENT submits request
        │
        ▼
PENDING_FACULTY
        │
  FACULTY actions
   ├─ Forward ───────────────► PENDING_STAFF
   └─ Reject  ───────────────► REJECTED

FACULTY submits request
        │
        ▼
PENDING_STAFF

PENDING_STAFF
   STAFF actions
   ├─ Approve ───────────────► APPROVED + booking created
   └─ Reject  ───────────────► REJECTED

PENDING_FACULTY or PENDING_STAFF
   Owner/Admin can cancel ───► CANCELLED
```

- Note: In current booking-request routes, ADMIN can cancel but does not directly approve/reject booking requests.

### Change Request Flows

**Slot Change**: FACULTY creates `PENDING` → STAFF/ADMIN approve (old booking replaced with new slot booking) or reject → FACULTY may cancel while pending.

**Venue Change**: FACULTY creates `PENDING` → STAFF/ADMIN approve (booking moved to proposed room) or reject → FACULTY may cancel while pending.

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| Database Tables | 24 |
| API Endpoints | ~50 |
| Frontend Pages | 10 |
| UI Components | 20+ |
| Custom Hooks | 10+ |
| Zod Schemas | 15+ |
| Migration Files | 24 |

This system provides a complete solution for university room allocation with robust authentication, role-based access control, approval workflows, and bulk timetable import capabilities.
