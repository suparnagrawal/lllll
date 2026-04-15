import { Router } from "express";
import { eq } from "drizzle-orm";
import { authMiddleware } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/rbac";
import { validate } from "../../../api/middleware/validation.middleware";
import { idParamSchema } from "../../../shared/validators/schemas/common.schemas";
import {
  createHolidaySchema,
  listHolidaysSchema,
} from "../../../shared/validators/schemas/holiday.schemas";
import { db } from "../../../db";
import { holidays } from "../../../db/schema";
import { normalizeDateOnlyKey } from "../../../shared/utils/istDateTime";
import {
  listHolidays,
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

    const rows = await listHolidays({ fromDate, toDate });
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
