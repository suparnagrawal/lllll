# Universal Room Allocation System - User Guide

## Welcome

The **Universal Room Allocation System (URA)** is a web application for booking classrooms, lecture halls, and other spaces at IIT Jodhpur. Whether you need a room for a class, seminar, meeting, or event, this system helps you find available spaces and manage your bookings.

---

## Getting Started

### Accessing the System

1. Open your web browser and go to: **http://localhost:5173**
2. You'll see the login page

### Signing In

**Option 1: Google Sign-In (Recommended)**
- Click **"Sign in with Google"**
- Use your **@iitj.ac.in** email account
- Grant permission when prompted
- First-time users will need to complete a quick setup

**Option 2: Email/Password**
- Enter your registered email and password
- Click **"Sign In"**

### First-Time Setup (Google Sign-In)

If this is your first time signing in with Google:
1. You'll be redirected to the **Setup** page
2. Select your role:
   - **Student** - For students requesting rooms for events
   - **Faculty** - For faculty members managing course schedules
3. Enter your department (optional)
4. Click **"Complete Setup"**

---

## User Roles & Permissions

| Role | What You Can Do |
|------|-----------------|
| **Student** | View rooms, check availability, submit booking requests |
| **Faculty** | All student permissions + approve student requests, request slot/venue changes |
| **Staff** | Manage rooms & buildings, approve requests, create direct bookings |
| **Admin** | Full system access including user management and timetable import |

---

## Main Features

### 1. Dashboard (Home Page)

Your dashboard shows:
- **Quick Stats**: Total bookings, pending requests, available rooms
- **Upcoming Bookings**: Your next scheduled reservations
- **Recent Activity**: Latest updates on your requests

### 2. Check Room Availability

**How to check if a room is free:**

1. Click **"Availability"** in the sidebar
2. Select a **date** using the calendar
3. Optionally filter by **building**
4. View the availability grid showing:
   - 🟢 **Green**: Room is available
   - 🔴 **Red**: Room is booked
   - Click on any slot to see booking details

**Quick Tips:**
- Use the building filter to narrow down options
- Hover over booked slots to see who booked them
- Click on a room name to see its full schedule

### 3. Browse Rooms

**How to find the right room:**

1. Click **"Rooms"** in the sidebar
2. Browse the list of all rooms
3. Use filters to find rooms with:
   - Specific **capacity** (e.g., seats 50+)
   - **Equipment** (projector, microphone)
   - **Accessibility** features
   - Specific **building** location

**Room Information:**
- Room name and building
- Capacity (number of seats)
- Room type (Lecture Hall, Classroom, Lab, etc.)
- Available equipment
- Accessibility status

### 4. Submit a Booking Request

**How to request a room:**

1. Click **"Requests"** in the sidebar
2. Click the **"New Request"** button
3. Fill in the booking wizard:

   **Step 1 - Event Details:**
   - Event title (e.g., "Python Workshop")
   - Event type (Quiz, Seminar, Meeting, Workshop, etc.)
   - Expected number of participants

   **Step 2 - Date & Time:**
   - Select the date
   - Choose start and end time
   
   **Step 3 - Room Selection:**
   - System shows available rooms for your time
   - Select a room that meets your needs
   
   **Step 4 - Review & Submit:**
   - Review all details
   - Add any notes/purpose description
   - Click **"Submit Request"**

4. Your request is now **pending approval**

### 5. Track Your Requests

**How to check request status:**

1. Go to **"Requests"** page
2. View your requests with status:
   - ⏳ **Pending Faculty** - Waiting for faculty approval
   - ⏳ **Pending Staff** - Waiting for staff approval
   - ✅ **Approved** - Room is booked for you
   - ❌ **Rejected** - Request was declined (see reason)
   - 🚫 **Cancelled** - You cancelled the request

**Request Actions:**
- **Cancel**: Withdraw a pending request
- **View Details**: See full request information

### 6. View Your Bookings

Once your request is approved, it becomes a booking:

1. Go to **"Availability"** and find your booking
2. Or check **"Dashboard"** for upcoming bookings
3. Booking details show:
   - Room and building
   - Date and time
   - Event information

---

## For Faculty Members

### Approving Student Requests

When a student from your department submits a request:

1. You'll receive a **notification**
2. Go to **"Requests"** page
3. Find requests with status **"Pending Faculty"**
4. Review the request details
5. Choose an action:
   - **Approve** - If you support the request
   - **Forward to Staff** - Send for final approval
   - **Reject** - Decline with a reason

### Requesting Slot Changes

If you need to change a class time:

1. Go to the booking you want to change
2. Click **"Request Slot Change"**
3. Select the new date/time
4. Provide a reason for the change
5. Submit for staff approval

### Requesting Venue Changes

If you need a different room:

1. Go to the booking you want to change
2. Click **"Request Venue Change"**
3. Select the new room
4. Provide a reason for the change
5. Submit for staff approval

---

## For Staff Members

### Managing Bookings

1. Go to **"Bookings"** page
2. View all bookings for your assigned buildings
3. Actions available:
   - **Create Booking** - Book rooms directly
   - **Edit Booking** - Change room or time
   - **Delete Booking** - Cancel a booking

### Approving Requests

1. Go to **"Requests"** page
2. Find requests with status **"Pending Staff"**
3. Review request details
4. Choose an action:
   - **Approve** - Creates the booking
   - **Reject** - Decline with a reason

### Managing Rooms

1. Go to **"Rooms"** page
2. Actions available:
   - **Add Room** - Create new room
   - **Edit Room** - Update room details
   - **Delete Room** - Remove room from system

---

## For Administrators

### User Management

1. Go to **"Users"** page
2. View all system users
3. Actions available:
   - **Create User** - Add new user
   - **Change Role** - Update user permissions
   - **Assign Staff to Building** - Set staff building access
   - **Deactivate User** - Disable account

### Timetable Import

1. Go to **"Timetable"** page
2. **Create Slot System** - Define your academic schedule structure
3. **Import Timetable**:
   - Upload Excel file with course schedules
   - Review parsed data
   - Resolve any conflicts or errors
   - Commit to create bookings

### Building Management

1. Go to **"Rooms"** page
2. Switch to **"Buildings"** tab
3. Actions available:
   - **Add Building** - Create new building
   - **Edit Building** - Update building details
   - **Assign Staff** - Set building managers

---

## Notifications

### How Notifications Work

You'll receive notifications when:
- ✉️ Your booking request status changes
- ✉️ A request needs your approval (Faculty/Staff)
- ✉️ Your slot/venue change request is processed

### Viewing Notifications

1. Click the **bell icon** in the top navigation
2. See your recent notifications
3. Click to view details
4. Mark as read when done

### Email Notifications

Faculty and Students also receive **email notifications** for important updates (if email is configured).

---

## Tips & Best Practices

### For Better Booking Success

1. **Book Early** - Submit requests at least 3-5 days in advance
2. **Check Availability First** - Verify room is free before requesting
3. **Be Specific** - Include clear event details and purpose
4. **Right-Size Your Room** - Choose capacity matching your needs
5. **Have Backups** - Note alternative rooms in case first choice is taken

### Common Issues & Solutions

| Problem | Solution |
|---------|----------|
| Can't find available rooms | Try different dates/times or check other buildings |
| Request rejected | Read rejection reason, adjust request, resubmit |
| Can't see certain pages | Your role may not have access - contact admin |
| Session expired | Log in again; sessions timeout after 35 min inactivity |
| Too many requests error | Wait a few minutes; rate limiting is active |

---

## Quick Reference

### Event Types

| Type | Use For |
|------|---------|
| **Class** | Regular course sessions |
| **Quiz** | Tests and examinations |
| **Seminar** | Academic presentations |
| **Speaker Session** | Guest lectures |
| **Meeting** | Departmental meetings |
| **Workshop** | Hands-on training sessions |
| **Cultural Event** | Club activities, performances |
| **Other** | Anything else |

### Room Types

| Type | Description |
|------|-------------|
| **Lecture Hall** | Large capacity (100+ seats), tiered seating |
| **Classroom** | Medium capacity (30-60 seats), standard layout |
| **Seminar Room** | Small capacity (20-30 seats), discussion layout |
| **Computer Lab** | Equipped with computers |
| **Conference Room** | Meeting tables, video conferencing |
| **Auditorium** | Large events, stage, AV equipment |
| **Workshop** | Practical/hands-on activities |

### Request Status Flow

```
Submit Request
      │
      ▼
Pending Faculty ──► Faculty Reviews
      │                    │
      │         ┌──────────┴──────────┐
      │         │                     │
      │      Approved             Forwarded
      │         │                     │
      │         │                     ▼
      │         │            Pending Staff
      │         │                     │
      │         │         ┌───────────┴───────────┐
      │         │         │                       │
      │         │      Approved                Rejected
      │         │         │                       │
      │         ▼         ▼                       ▼
      └────► BOOKING CREATED                 REJECTED
```

---

## Getting Help

### Contact Support

If you encounter issues or have questions:
- **Technical Issues**: Contact the IT department
- **Room/Building Questions**: Contact the relevant building staff
- **Account Issues**: Contact the system administrator

### Session Information

- **Session Timeout**: 35 minutes of inactivity
- **Session Warning**: You'll see a warning at 30 minutes
- **Token Refresh**: Automatic every 5 minutes while active

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Esc` | Close dialogs/modals |
| `Enter` | Submit forms |
| `Tab` | Navigate between fields |

---

## Browser Support

For the best experience, use:
- Google Chrome (recommended)
- Mozilla Firefox
- Microsoft Edge
- Safari

**Note**: Enable JavaScript and cookies for full functionality.

---

## Glossary

| Term | Definition |
|------|------------|
| **Booking** | A confirmed room reservation |
| **Request** | A pending booking that needs approval |
| **Slot** | A specific time period in the schedule |
| **Venue** | The room/location for an event |
| **Building** | A physical structure containing rooms |
| **Slot Change** | Changing the time of an existing booking |
| **Venue Change** | Changing the room of an existing booking |

---

*Last Updated: April 2026*
