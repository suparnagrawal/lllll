import { type Request, type Response, Router } from "express";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import passport from "../auth/passport";
import { signAuthToken, signRefreshToken, verifySetupToken, verifyRefreshToken } from "../auth/jwt";
import { env, isGoogleOAuthConfigured } from "../config/env";
import { db } from "../db";
import { users } from "../db/schema";
import { authMiddleware } from "../middleware/auth";
import logger from "../shared/utils/logger";

const router = Router();

type SetupRole = "STUDENT" | "FACULTY";

function buildFrontendUrl(pathname: string, params?: Record<string, string>): string {
  const normalizedBase = env.FRONTEND_URL.endsWith("/")
    ? env.FRONTEND_URL
    : `${env.FRONTEND_URL}/`;

  const url = new URL(pathname, normalizedBase);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}

function getOAuthFailedRedirectUrl(): string {
  return buildFrontendUrl("/login", { error: "oauth_failed" });
}

function readBearerToken(req: Request): string | null {
  const rawHeader = req.headers.authorization;

  if (!rawHeader || !rawHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = rawHeader.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

async function cleanupOAuthSession(req: Request, res: Response): Promise<void> {
  await new Promise<void>((resolve) => {
    const destroySession = () => {
      if (!req.session) {
        resolve();
        return;
      }

      req.session.destroy((destroyError) => {
        if (destroyError) {
          logger.error(destroyError);
        }

        resolve();
      });
    };

    if (typeof req.logout === "function") {
      req.logout((logoutError) => {
        if (logoutError) {
          logger.error(logoutError);
        }

        destroySession();
      });

      return;
    }

    destroySession();
  });

  res.clearCookie("connect.sid");
}

// ------------------------
// POST /auth/login
// ------------------------
router.post("/login", async (req, res) => {
  try {
    const email = req.body?.email?.trim()?.toLowerCase();
    const password = req.body?.password;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Find user
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    const user = rows[0];

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (user.registeredVia === "google" || user.googleId !== null) {
      return res.status(403).json({
        error: "This account uses Google login. Please continue with Google.",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: "Your account is inactive" });
    }

    if (user.role === "PENDING_ROLE") {
      return res.status(403).json({
        error: "Account setup is incomplete. Complete role setup first.",
      });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate JWT tokens
    const accessToken = signAuthToken({ id: user.id, role: user.role });
    const refreshToken = signRefreshToken({ id: user.id, role: user.role });

    return res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.displayName ?? user.name,
        role: user.role,
      },
    });

  } catch (error) {
    logger.error(error);
    return res.status(500).json({ error: "Login failed" });
  }
});

// ------------------------
// GET /auth/me
// ------------------------
router.get("/me", authMiddleware, async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const rows = await db
      .select()
      .from(users)
      .where(eq(users.id, req.user.id))
      .limit(1);

    const user = rows[0];

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: "Your account is inactive" });
    }

    return res.json({
      id: user.id,
      name: user.displayName ?? user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      avatarUrl: user.avatarUrl,
    });
  } catch (error) {
    logger.error(error);
    return res.status(500).json({ error: "Failed to fetch current user" });
  }
});

if (isGoogleOAuthConfigured) {
  router.get(
    "/google",
    passport.authenticate("google", {
      scope: ["profile", "email"],
      session: true,
    }),
  );

  router.get("/google/callback", (req, res, next) => {
    passport.authenticate(
      "google",
      { session: true },
      async (error: unknown, authenticatedUser: Express.User | false) => {
        const failedRedirect = getOAuthFailedRedirectUrl();

        if (error || !authenticatedUser) {
          if (error) {
            logger.error(error);
          }

          await cleanupOAuthSession(req, res);
          return res.redirect(failedRedirect);
        }

        const user = authenticatedUser as typeof users.$inferSelect;

        try {
          if (!user.isActive) {
            await cleanupOAuthSession(req, res);
            return res.redirect(failedRedirect);
          }

          let effectiveUser = user;

          if (effectiveUser.role === "PENDING_ROLE") {
            const [updated] = await db
              .update(users)
              .set({
                role: "STUDENT",
                firstLogin: true,
              })
              .where(eq(users.id, effectiveUser.id))
              .returning();

            if (updated) {
              effectiveUser = updated;
            }
          }

          let redirectUrl: string;

          if (effectiveUser.firstLogin) {
            const accessToken = signAuthToken({ id: effectiveUser.id, role: effectiveUser.role });
            const refreshToken = signRefreshToken({ 
              id: effectiveUser.id, 
              role: effectiveUser.role as Exclude<typeof effectiveUser.role, "PENDING_ROLE">
            });

            await db
              .update(users)
              .set({ firstLogin: false })
              .where(eq(users.id, effectiveUser.id));

            redirectUrl = buildFrontendUrl("/auth/callback", {
              accessToken,
              refreshToken,
              firstLogin: "true",
              role: effectiveUser.role,
            });
          } else {
            const accessToken = signAuthToken({ id: effectiveUser.id, role: effectiveUser.role });
            const refreshToken = signRefreshToken({ 
              id: effectiveUser.id, 
              role: effectiveUser.role as Exclude<typeof effectiveUser.role, "PENDING_ROLE">
            });
            redirectUrl = buildFrontendUrl("/auth/callback", { accessToken, refreshToken });
          }

          await cleanupOAuthSession(req, res);
          return res.redirect(redirectUrl);
        } catch (callbackError) {
          logger.error(callbackError);
          await cleanupOAuthSession(req, res);
          return res.redirect(failedRedirect);
        }
      },
    )(req, res, next);
  });

  router.get("/google/failed", async (req, res) => {
    await cleanupOAuthSession(req, res);
    return res.redirect(getOAuthFailedRedirectUrl());
  });
} else {
  router.get("/google", (_req, res) => {
    return res.status(503).json({ error: "Google OAuth is not configured" });
  });

  router.get("/google/callback", (_req, res) => {
    return res.status(503).json({ error: "Google OAuth is not configured" });
  });

  router.get("/google/failed", (_req, res) => {
    return res.status(503).json({ error: "Google OAuth is not configured" });
  });
}

// ------------------------
// POST /auth/complete-setup
// ------------------------
router.post("/complete-setup", async (req, res) => {
  try {
    const token = readBearerToken(req);

    if (!token) {
      return res.status(401).json({ error: "Setup token is required" });
    }

    const decoded = verifySetupToken(token);

    if (!decoded) {
      return res.status(401).json({ error: "Invalid or expired setup token" });
    }

    const role = req.body?.role as SetupRole | undefined;
    const rawDepartment = req.body?.department;

    if (role !== "STUDENT" && role !== "FACULTY") {
      return res.status(400).json({
        error: "role must be STUDENT or FACULTY",
      });
    }

    if (rawDepartment !== undefined && typeof rawDepartment !== "string") {
      return res.status(400).json({
        error: "department must be a string when provided",
      });
    }

    const department =
      typeof rawDepartment === "string" && rawDepartment.trim().length > 0
        ? rawDepartment.trim()
        : null;

    const rows = await db
      .select()
      .from(users)
      .where(eq(users.id, decoded.id))
      .limit(1);

    const user = rows[0];

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: "Your account is inactive" });
    }

    if (user.role !== "PENDING_ROLE") {
      return res.status(400).json({
        error: "Setup has already been completed for this account",
      });
    }

    const [updated] = await db
      .update(users)
      .set({
        role,
        department,
        firstLogin: false,
      })
      .where(eq(users.id, user.id))
      .returning();

    if (!updated) {
      return res.status(500).json({ error: "Failed to complete setup" });
    }

    const accessToken = signAuthToken({ id: updated.id, role });
    const refreshToken = signRefreshToken({ id: updated.id, role });

    return res.json({
      accessToken,
      refreshToken,
      user: {
        id: updated.id,
        name: updated.displayName ?? updated.name,
        role: updated.role,
      },
    });
  } catch (error) {
    logger.error(error);
    return res.status(500).json({ error: "Complete setup failed" });
  }
});

// ------------------------
// POST /auth/refresh
// ------------------------
router.post("/refresh", async (req, res) => {
  try {
    const refreshToken = req.body?.refreshToken;

    if (!refreshToken) {
      return res.status(400).json({ error: "Refresh token is required" });
    }

    const decoded = verifyRefreshToken(refreshToken);

    if (!decoded) {
      return res.status(401).json({ error: "Invalid or expired refresh token" });
    }

    const rows = await db
      .select()
      .from(users)
      .where(eq(users.id, decoded.id))
      .limit(1);

    const user = rows[0];

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: "Your account is inactive" });
    }

    const accessToken = signAuthToken({ id: user.id, role: user.role });
    const newRefreshToken = signRefreshToken({ 
      id: user.id, 
      role: user.role as Exclude<typeof user.role, "PENDING_ROLE">
    });

    return res.json({
      accessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        name: user.displayName ?? user.name,
        role: user.role,
      },
    });
  } catch (error) {
    logger.error(error);
    return res.status(500).json({ error: "Token refresh failed" });
  }
});

export default router;