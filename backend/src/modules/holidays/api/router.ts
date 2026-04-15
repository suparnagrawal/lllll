import { Router } from "express";
import { eq } from "drizzle-orm";
import { authMiddleware } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/rbac";
import { validate } from "../../../api/middleware/validation.middleware";
import { idParamSchema } from "../../../shared/validators/schemas/common.schemas";
import {
  createHolidaySchema,
  listHolidaysSchema,
  listTimetableDayOverridesSchema,
  upsertTimetableDayOverrideSchema,
} from "../../../shared/validators/schemas/holiday.schemas";
import { db } from "../../../db";
import { holidays, timetableDayOverrides } from "../../../db/schema";
import { normalizeDateOnlyKey } from "../../../shared/utils/istDateTime";
import {
  listHolidays,
  listTimetableDayOverrides,
  pruneTimetableBookingsForHolidayRange,
} from "../service";

const router = Router();

router.get(
  "/",
  authMiddleware,
  validate({ query: listHolidaysSchema }),
  async (req, res) => {
    const fromDate = typeof req.query.fromDate === "string" ? req.query.fromDate : undefined;
    const toDate = typeof req.query.toDate === "string" ? req.query.toDate : undefined;

    const filters = {
      ...(fromDate ? { fromDate } : {}),
      ...(toDate ? { toDate } : {}),
    };

    const rows = await listHolidays(filters);
    return res.json(rows);
  },
);

router.post(
  "/",
  authMiddleware,
  requireRole("ADMIN"),
  validate({ body: createHolidaySchema }),
  async (req, res) => {
    const normalizedStartDate = normalizeDateOnlyKey(String(req.body.startDate));
    const normalizedEndDate = normalizeDateOnlyKey(String(req.body.endDate));

    if (!normalizedStartDate || !normalizedEndDate) {
      return res.status(400).json({ message: "Invalid holiday date range" });
    }

    const response = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(holidays)
        .values({
          name: String(req.body.name).trim(),
          description:
            typeof req.body.description === "string" && req.body.description.trim().length > 0
              ? req.body.description.trim()
              : null,
          startDate: normalizedStartDate,
          endDate: normalizedEndDate,
          createdBy: req.user?.id ?? null,
        })
        .returning();

      const created = inserted[0];

      if (!created) {
        throw new Error("Failed to create holiday");
      }

      const prunedTimetableBookings = await pruneTimetableBookingsForHolidayRange(
        normalizedStartDate,
        normalizedEndDate,
        tx,
      );

      return {
        holiday: created,
        prunedTimetableBookings,
      };
    });

    return res.status(201).json(response);
  },
);

router.get(
  "/day-overrides",
  authMiddleware,
  validate({ query: listTimetableDayOverridesSchema }),
  async (req, res) => {
    const fromDate = typeof req.query.fromDate === "string" ? req.query.fromDate : undefined;
    const toDate = typeof req.query.toDate === "string" ? req.query.toDate : undefined;

    const filters = {
      ...(fromDate ? { fromDate } : {}),
      ...(toDate ? { toDate } : {}),
    };

    const rows = await listTimetableDayOverrides(filters);
    return res.json(rows);
  },
);

router.post(
  "/day-overrides",
  authMiddleware,
  requireRole("ADMIN"),
  validate({ body: upsertTimetableDayOverrideSchema }),
  async (req, res) => {
    const normalizedTargetDate = normalizeDateOnlyKey(String(req.body.targetDate));

    if (!normalizedTargetDate) {
      return res.status(400).json({ message: "Invalid targetDate" });
    }

    const followsDayOfWeek = String(req.body.followsDayOfWeek).trim().toUpperCase();
    const note =
      typeof req.body.note === "string" && req.body.note.trim().length > 0
        ? req.body.note.trim()
        : null;

    const [saved] = await db
      .insert(timetableDayOverrides)
      .values({
        targetDate: normalizedTargetDate,
        followsDayOfWeek: followsDayOfWeek as (typeof timetableDayOverrides.$inferInsert)["followsDayOfWeek"],
        note,
        createdBy: req.user?.id ?? null,
        updatedBy: req.user?.id ?? null,
      })
      .onConflictDoUpdate({
        target: timetableDayOverrides.targetDate,
        set: {
          followsDayOfWeek: followsDayOfWeek as (typeof timetableDayOverrides.$inferInsert)["followsDayOfWeek"],
          note,
          updatedBy: req.user?.id ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();

    if (!saved) {
      return res.status(500).json({ message: "Failed to save day override" });
    }

    return res.json(saved);
  },
);

router.delete(
  "/day-overrides/:id",
  authMiddleware,
  requireRole("ADMIN"),
  validate({ params: idParamSchema }),
  async (req, res) => {
    const overrideId = Number(req.params.id);

    const deleted = await db
      .delete(timetableDayOverrides)
      .where(eq(timetableDayOverrides.id, overrideId))
      .returning({ id: timetableDayOverrides.id });

    if (deleted.length === 0) {
      return res.status(404).json({ message: "Day override not found" });
    }

    return res.status(204).send();
  },
);

router.delete(
  "/:id",
  authMiddleware,
  requireRole("ADMIN"),
  validate({ params: idParamSchema }),
  async (req, res) => {
    const holidayId = Number(req.params.id);

    const deleted = await db
      .delete(holidays)
      .where(eq(holidays.id, holidayId))
      .returning({ id: holidays.id });

    if (deleted.length === 0) {
      return res.status(404).json({ message: "Holiday not found" });
    }

    return res.status(204).send();
  },
);

export default router;
