import { Router, Request, Response } from 'express';
import { authMiddleware } from "../middleware/auth";
import { getAssignedBuildingIdsForStaff } from "../services/staffBuildingScope";
import { getAvailabilityWithBookingsAndRbac, BuildingWithRooms } from '../data/queries/availability.queries';
import logger from "../shared/utils/logger";

const router = Router();

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseOptionalInt(value: unknown): number | null {
  if (value === undefined) return null;
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

router.get('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const startAt = parseDate(req.query.startAt);
  const endAt = parseDate(req.query.endAt);
  const buildingId = parseOptionalInt(req.query.buildingId);

  if (!startAt || !endAt || startAt.getTime() >= endAt.getTime()) {
    res.status(400).json({ message: 'Invalid startAt or endAt' });
    return;
  }

  if (req.query.buildingId !== undefined && buildingId === null) {
    res.status(400).json({ message: 'Invalid buildingId' });
    return;
  }

  try {
    const isStaff = req.user?.role === "STAFF";
    const assignedBuildingIds = isStaff
      ? await getAssignedBuildingIdsForStaff(req.user!.id)
      : [];

    if (isStaff && buildingId !== null && !assignedBuildingIds.includes(buildingId)) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    if (isStaff && assignedBuildingIds.length === 0) {
      res.json([]);
      return;
    }

    const result = await getAvailabilityWithBookingsAndRbac({
      startAt,
      endAt,
      buildingId: buildingId ?? undefined,
      buildingIds: isStaff ? assignedBuildingIds : [],
      userId: req.user!.id,
      userRole: req.user!.role,
      staffBuildingIds: assignedBuildingIds,
    });

    res.json(result);
  } catch (error) {
    logger.error('GET /availability error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;