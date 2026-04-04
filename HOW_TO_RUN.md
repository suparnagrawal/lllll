# How to Run the Universal Room Allocation System

This is a full-stack application for managing room bookings and allocations. This guide covers everything you need to set up and run the project.

## 📋 Table of Contents

- [Project Overview](#project-overview)
- [Prerequisites](#prerequisites)
- [Quick Start (5 minutes)](#quick-start-5-minutes)
- [Detailed Setup Instructions](#detailed-setup-instructions)
- [Running the Application](#running-the-application)
- [Database & Services](#database--services)
- [Project Structure](#project-structure)
- [Available Commands](#available-commands)
- [Common Issues & Troubleshooting](#common-issues--troubleshooting)

---

## 🎯 Project Overview

**Universal Room Allocation System** is a full-stack web application built with:

- **Backend**: Node.js + Express + TypeScript
- **Frontend**: React + Vite + TypeScript
- **Database**: PostgreSQL
- **Cache/Sessions**: Redis
- **Authentication**: JWT + Google OAuth 2.0

The system manages:
- Room and building availability
- Booking requests and allocations
- User authentication and authorization
- Email notifications
- File uploads and Excel processing

---

## 📦 Prerequisites

Before you begin, ensure you have installed:

- **Node.js** v18 or higher ([Download](https://nodejs.org/))
- **npm** (comes with Node.js) or **yarn**
- **Docker** & **Docker Compose** ([Install Docker Desktop](https://www.docker.com/products/docker-desktop))
- **Git** (to clone/manage the repository)

**Verify installations:**
```bash
node --version      # Should be v18+
npm --version       # Should be v9+
docker --version    # Should be v20+
```

---

## ⚡ Quick Start (5 minutes)

If you want to get up and running quickly:

```bash
# 1. Install dependencies
cd backend && npm install && cd ../frontend && npm install && cd ..

# 2. Start database and cache services
docker-compose up -d

# 3. Configure environment (if not already done)
cd backend
cp .env.example .env  # Skip if .env already exists

# 4. Initialize database
npx drizzle-kit migrate

# 5. Start development servers (in separate terminals)
# Terminal 1:
npm run dev    # from backend/

# Terminal 2:
npm run dev    # from frontend/
```

Then visit:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000/api

---

## 🔧 Detailed Setup Instructions

### Step 1: Navigate to Project Directory

```bash
cd /home/suparn/software
```

### Step 2: Install Backend Dependencies

```bash
cd backend
npm install
cd ..
```

This installs packages including:
- Express.js, TypeScript, ts-node-dev
- Drizzle ORM, PostgreSQL driver
- Authentication (Passport, JWT, bcrypt)
- Rate limiting, caching, logging
- File upload, Excel processing

### Step 3: Install Frontend Dependencies

```bash
cd frontend
npm install
cd ..
```

This installs:
- React, Vite, TypeScript
- React Router, React Hook Form
- TanStack React Query (data fetching)
- Tailwind CSS, shadcn/ui components
- ESLint, development tools

### Step 4: Start Database Services

PostgreSQL and Redis are containerized in Docker:

```bash
# Start services in the background
docker-compose up -d

# Verify services are running
docker-compose ps
```

Expected output shows two running containers:
- `ura_postgres` (PostgreSQL on port 5433)
- `ura_redis` (Redis on port 6379)

### Step 5: Configure Environment Variables

The backend needs configuration via a `.env` file:

```bash
cd backend

# Copy the template if .env doesn't exist
cp .env.example .env

# Edit .env with your settings
nano .env  # or use your preferred editor
```

**Key variables to configure:**

```env
# Database
DATABASE_URL=postgres://ura_user:ura_pass@localhost:5433/ura_system

# Redis (for caching and sessions)
REDIS_URL=redis://localhost:6379

# Node environment
NODE_ENV=development

# API & Frontend URLs
BACKEND_URL=http://localhost:5000
FRONTEND_URL=http://localhost:5173

# Secrets (generate random strings for development)
JWT_SECRET=your-random-jwt-secret-here
SESSION_SECRET=your-random-session-secret-here

# Google OAuth (optional, for login)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Email (optional, for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

> **Note**: Development credentials may already be in `.env.example`. For production, generate new secrets and OAuth credentials.

### Step 6: Initialize the Database

Run migrations to create database tables:

```bash
cd backend

# Run Drizzle migrations
npx drizzle-kit migrate

# (Optional) Seed test data
npm run seed:classrooms
```

This creates all necessary tables and inserts sample classroom data.

---

## 🚀 Running the Application

### Option A: Run Both Services (Development Mode)

**Terminal 1 - Start Backend:**
```bash
cd backend
npm run dev
```

Expected output:
```
[nodemon] starting server...
Server running on port 5000
```

**Terminal 2 - Start Frontend:**
```bash
cd frontend
npm run dev
```

Expected output:
```
VITE v8.0.1
Local:   http://localhost:5173/
```

Now open **http://localhost:5173** in your browser.

### Option B: Run Services with Docker (Optional)

If you want to containerize the entire stack:

```bash
# Build Docker images for backend and frontend
docker-compose build

# Start all services
docker-compose up
```

---

## 🗄️ Database & Services

### PostgreSQL

- **Container**: `ura_postgres`
- **Host**: localhost
- **Port**: 5433 (maps to internal 5432)
- **User**: `ura_user`
- **Password**: `ura_pass`
- **Database**: `ura_system`

**Connect to PostgreSQL directly:**
```bash
psql -h localhost -p 5433 -U ura_user -d ura_system
```

### Redis

- **Container**: `ura_redis`
- **Host**: localhost
- **Port**: 6379

**Connect to Redis directly:**
```bash
redis-cli -h localhost -p 6379
```

### Manage Services

```bash
# View running services
docker-compose ps

# Stop services
docker-compose down

# Stop services and remove data volumes
docker-compose down -v

# View logs
docker-compose logs -f ura_postgres
docker-compose logs -f ura_redis

# Restart a service
docker-compose restart ura_postgres
```

---

## 📁 Project Structure

```
/home/suparn/software/
│
├── backend/                    # Node.js/Express API
│   ├── src/
│   │   ├── server.ts           # Express app entry point
│   │   ├── api/                # Controllers & routes
│   │   ├── auth/               # Authentication logic
│   │   ├── config/             # Configuration files
│   │   ├── db/                 # Database schema & connection
│   │   ├── domain/             # Services & validators
│   │   ├── middleware/         # Express middleware
│   │   ├── modules/            # Feature modules
│   │   └── shared/             # Utilities & types
│   ├── drizzle/                # Database migrations
│   ├── scripts/                # Seed scripts
│   ├── package.json
│   ├── drizzle.config.js
│   ├── tsconfig.json
│   ├── .env                    # Configuration (local)
│   └── .env.example            # Configuration template
│
├── frontend/                   # React + Vite SPA
│   ├── src/
│   │   ├── main.tsx            # React entry point
│   │   ├── App.tsx             # Root component
│   │   ├── api/                # API client
│   │   ├── auth/               # Authentication context
│   │   ├── components/         # UI components
│   │   ├── pages/              # Page components
│   │   ├── routes/             # Route definitions
│   │   ├── hooks/              # Custom hooks
│   │   ├── lib/                # Utilities
│   │   └── context/            # React context
│   ├── public/                 # Static assets
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   └── index.html
│
├── shared/                     # Shared utilities & validators
│   ├── utils/
│   └── validators/
│
├── docs/                       # Project documentation
│   ├── README.md
│   ├── MASTER_PLAN_SUMMARY.md
│   ├── IMPLEMENTATION_PROMPTS.md
│   └── ...
│
├── docker-compose.yml          # Database + Redis containers
├── HOW_TO_RUN.md              # This file
└── .gitignore
```

---

## ⚙️ Available Commands

### Backend Commands

```bash
cd backend

# Start development server (with hot reload)
npm run dev

# Run tests
npm test

# Seed classroom data
npm run seed:classrooms

# Manage migrations (Drizzle ORM)
npx drizzle-kit migrate          # Apply migrations
npx drizzle-kit generate         # Generate migration files
npx drizzle-kit push             # Push schema to database
npx drizzle-kit studio           # Open Drizzle Studio (DB browser)
```

### Frontend Commands

```bash
cd frontend

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

### Docker Commands

```bash
cd /home/suparn/software

# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# Rebuild containers
docker-compose build
```

---

## 🔐 Authentication

The application supports two authentication methods:

### 1. **JWT (JSON Web Tokens)**
- Used for API requests
- Token stored in `Authorization: Bearer <token>` header
- Configured in backend `.env` as `JWT_SECRET`

### 2. **Google OAuth 2.0**
- Configured for user login/signup
- Requires `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`
- Callback: `http://localhost:5000/api/auth/google/callback`

### Default Test User
Check `.env.example` or the backend for any default credentials for testing.

---

## 🔍 Testing the API

### Using cURL

```bash
# Health check
curl http://localhost:5000/api/health

# Get available rooms
curl http://localhost:5000/api/rooms

# Login and get token
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# Use token in requests
curl http://localhost:5000/api/bookings \
  -H "Authorization: Bearer <your-token-here>"
```

### Using Frontend UI

Simply navigate to http://localhost:5173 and use the web interface to:
- Sign up or log in
- Browse available rooms
- Make booking requests
- View allocations

---

## 🐛 Common Issues & Troubleshooting

### Issue: Port 5173 or 5000 Already in Use

**Problem**: Backend or frontend fails to start because port is already in use.

**Solution**:
```bash
# Find what's using the port
lsof -i :5000    # for backend
lsof -i :5173    # for frontend

# Kill the process
kill -9 <PID>

# Or run on a different port
npm run dev -- --port 3000   # frontend
PORT=3001 npm run dev         # backend
```

### Issue: PostgreSQL Connection Refused

**Problem**: Backend fails with "connect ECONNREFUSED 127.0.0.1:5433"

**Solution**:
```bash
# Ensure Docker services are running
docker-compose up -d

# Check if containers are running
docker-compose ps

# Verify database is accessible
docker exec -it ura_postgres psql -U ura_user -d ura_system -c "SELECT 1"

# Rebuild services if needed
docker-compose down -v
docker-compose up -d
```

### Issue: "DATABASE_URL not found"

**Problem**: Backend fails with "DATABASE_URL is not defined"

**Solution**:
```bash
cd backend

# Check .env exists and has DATABASE_URL
cat .env | grep DATABASE_URL

# If missing, copy from example
cp .env.example .env

# Edit .env with correct values
nano .env
```

### Issue: Dependencies Installation Fails

**Problem**: `npm install` fails with "peer dependency" or "version conflict" errors

**Solution**:
```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Reinstall
npm install

# If still failing, use legacy peer deps flag
npm install --legacy-peer-deps
```

### Issue: Frontend Shows "Cannot find API"

**Problem**: Frontend can't connect to backend API

**Solution**:
1. Verify backend is running: `curl http://localhost:5000/api/health`
2. Check `FRONTEND_URL` and `BACKEND_URL` in backend `.env`
3. Check API base URL in frontend `/src/api/client.ts`
4. Ensure CORS is enabled in backend

### Issue: Hot Reload Not Working

**Problem**: Changes to code don't automatically reload

**Solution for Backend**:
```bash
# ts-node-dev should watch files automatically
npm run dev

# If not working, check tsconfig.json for exclude patterns
```

**Solution for Frontend**:
```bash
# Vite should watch automatically
npm run dev

# Try clearing Vite cache
rm -rf node_modules/.vite
npm run dev
```

---

## 📚 Additional Resources

- **Project Documentation**: See `/docs/` folder
  - `README.md` - Documentation guide
  - `MASTER_PLAN_SUMMARY.md` - System overview
  - `IMPLEMENTATION_PROMPTS.md` - Development tasks

- **Backend Stack**:
  - [Express.js Documentation](https://expressjs.com/)
  - [Drizzle ORM](https://orm.drizzle.team/)
  - [Passport.js Authentication](http://www.passportjs.org/)

- **Frontend Stack**:
  - [React Documentation](https://react.dev/)
  - [Vite Documentation](https://vitejs.dev/)
  - [React Router](https://reactrouter.com/)
  - [Tailwind CSS](https://tailwindcss.com/)
  - [shadcn/ui Components](https://ui.shadcn.com/)

---

## 🎯 Next Steps

1. ✅ Follow the **Quick Start** section to get everything running
2. 📖 Read `/docs/README.md` for project documentation
3. 🔍 Explore the API at http://localhost:5000/api
4. 💻 Start developing! The backend and frontend auto-reload on code changes
5. 📝 Check out `/docs/IMPLEMENTATION_PROMPTS.md` for development tasks

---

## ❓ Need Help?

- Check **Troubleshooting** section above
- Review logs: `docker-compose logs -f`
- Check backend: Terminal with `npm run dev` in `backend/`
- Check frontend: Terminal with `npm run dev` in `frontend/`
- Read project documentation in `/docs/` folder

Happy coding! 🚀
