import "./config/env"; // load env FIRST

import connectPgSimple from "connect-pg-simple";
import express from "express";
import session from "express-session";
import passport from "./auth/passport";
import { env } from "./config/env";
import { pool } from "./db";
import { generalLimiter, authLimiter, uploadLimiter } from "./api/middleware/rateLimit.middleware";
import { requestLogger } from "./api/middleware/requestLogger.middleware";
import { performanceMiddleware } from "./api/middleware/performance.middleware";
import buildingsRouter from "./routes/buildings";
import roomsRouter from "./routes/rooms";
import bookingsRouter from "./routes/bookings";
import bookingRequestsRouter from "./routes/bookingRequests";
import availabilityRoutes from './routes/availability';
import authRoutes from "./routes/auth";
import usersRoutes from "./routes/users";
import notificationsRoutes from "./routes/notifications";
import timetableRoutes from "./modules/timetable/routes";
import dashboardRoutes from "./routes/dashboard";
import healthRouter from "./api/routes/health.routes";
import logger from "./shared/utils/logger";


const app = express();
const PORT = env.PORT || 5000;
const sessionSecret = env.SESSION_SECRET ?? env.JWT_SECRET;

const PgSession = connectPgSimple(session);

app.use(
  session({
    store: new PgSession({
      pool,
      tableName: "user_sessions",
      createTableIfMissing: true,
    }),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 15 * 60 * 1000,
    },
  }),
);

app.use(passport.initialize());
app.use(passport.session());

app.use(express.json());

// Performance middleware - track response times
app.use(performanceMiddleware);

// Request logger middleware
app.use(requestLogger);

// Apply rate limiters
app.use("/api", generalLimiter);
app.use("/api/auth", authLimiter);
app.use("/api/timetable/imports", uploadLimiter);

// routes
app.use("/api/buildings", buildingsRouter);
app.use("/api/rooms", roomsRouter);
app.use("/api/bookings", bookingsRouter);
app.use("/api/booking-requests", bookingRequestsRouter);
app.use('/api/availability', availabilityRoutes);
app.use("/auth", authRoutes);
app.use("/api/auth", authRoutes);
app.use("/users", usersRoutes);
app.use("/api/users", usersRoutes);
app.use("/notifications", notificationsRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/timetable", timetableRoutes);
app.use("/api/timetable", timetableRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/health", healthRouter);

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});