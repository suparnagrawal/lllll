# URA System Demo Page Analysis

Based on the architecture and feature set of the **URA (University Room Allocation) System**, here is a comprehensive analysis on how to best create a compelling demo page or "demo mode" for the application.

## 1. Objectives of the Demo
The primary goal of a demo version is to let potential users (university administrators, faculty, and students) experience the core value of the URA system without the friction of deploying databases, configuring Google OAuth, or manually populating empty states.

## 2. Key Personas & Features to Showcase
The URA system relies heavily on role-based access control. A good demo page should allow the user to easily switch between these personas to see how they interact.

### 🏫 Admin Persona
* **The "Wow" Factor:** The Timetable Builder (`/timetable/workspace` and `/timetable/imports`). This is likely the most complex and powerful part of the app.
* **What to Show:** 
  * A pre-uploaded timetable CSV with some unresolved conflicts (e.g., "AMBIGUOUS_CLASSROOM" or "UNRESOLVED_SLOT").
  * The interface to resolve these conflicts manually vs. auto-resolve.
  * System-wide dashboard showing room utilization and pending requests.
  * User management and holiday calendar configuration.

### 👨‍🏫 Faculty/Staff Persona
* **The "Wow" Factor:** Seamless room booking and conflict prevention.
* **What to Show:**
  * The `Availability` page: Searching for a room with a projector for a specific time slot.
  * Making a booking request.
  * Viewing the status of their requests on their dashboard.

### 🎓 Student Persona
* **The "Wow" Factor:** Transparency and read-only access to schedules.
* **What to Show:**
  * Viewing the `Rooms` schedule to find an empty classroom for a club meeting.
  * A simplified dashboard showing upcoming events.

## 3. Data Seeding Requirements (The "Golden Dataset")
An empty demo is a bad demo. To make the system feel alive, you will need a robust seed script (expanding on `backend/seed.sql` and `seedDevData.mjs`) specifically for the demo environment:
* **Buildings & Rooms:** At least 3 buildings with ~15 rooms of varying types (LECTURE_HALL, CLASSROOM, LAB) and equipment configurations.
* **Timetable Data:** A fully committed "Default Slot System" with active timetable occurrences.
* **Bookings:** A mix of approved bookings, pending requests, and rejected requests (with internal notes).
* **Users:** Pre-configured mock users for each role.

## 4. Technical Implementation Strategies for the Demo

Here are two viable approaches for implementing the demo page:

### Approach A: The "Demo Mode" Toggle (Recommended)
You modify the existing application to support a demo mode via environment variables (e.g., `VITE_DEMO_MODE=true` on the frontend, `DEMO_MODE=true` on the backend).

* **Mock Authentication:** Instead of the standard Google OAuth or Email login on `LoginPage.tsx`, the demo login page presents three large buttons: 
  * `[ Login as Admin ]`
  * `[ Login as Faculty ]`
  * `[ Login as Student ]`
* Clicking these bypasses standard auth and issues a pre-signed JWT for a seeded mock user.
* **Read-Only vs Interactive:** You can allow interactive changes (like booking a room) but run a cron job (or Docker restart) every 24 hours to wipe the DB and re-run the demo seed script, ensuring the demo always stays fresh.

### Approach B: Static/Mocked Frontend Demo
If you want to host the demo on a static host (like Vercel or GitHub Pages) without spinning up the Node.js/Postgres backend:
* Use tools like **MSW (Mock Service Worker)** to intercept API calls.
* Replicate the backend logic in the browser using a local JSON store or IndexedDB.
* *Pros:* Zero hosting cost, infinite scalability.
* *Cons:* Requires duplicating backend logic (like conflict detection in the timetable builder) into the mock handlers, which is high effort.

## 5. Next Steps for Implementation
If you decide to proceed with building the demo, the suggested first steps are:
1. **Create the "Golden" Seed Script:** Expand `seed.sql` to include a rich, realistic dataset.
2. **Build the Demo Login Page:** Modify `LoginPage.tsx` to include "Quick Login" buttons when `VITE_DEMO_MODE` is active.
3. **Automate Resets (Optional):** Setup a scheduled task (e.g., via Render or a simple cron container in docker-compose) to reset the Postgres database to the golden state daily.
