import { Request, Response } from 'express';
import { db } from '../../db';
import { bookings, buildings, rooms } from '../../db/schema';
import { and, eq, gt, inArray, lt } from 'drizzle-orm';
import {
  getAssignedBuildingIdsForStaff,
  isBuildingAssignedToStaff,
} from '../../services/staffBuildingScope';
import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
  ConflictError,
} from '../../domain/errors/AppError';
import { getRoomDayAvailabilityQuery } from '../../data/queries/availability.queries';

export class RoomsController {
  async list(req: Request, res: Response): Promise<void> {
    const { buildingId } = req.query;
    const parsedBuildingId = buildingId ? Number(buildingId) : null;

    const isStaff = req.user?.role === 'STAFF';
    const assignedBuildingIds = isStaff
      ? await getAssignedBuildingIdsForStaff(req.user!.id)
      : [];

    // If buildingId is specified
    if (parsedBuildingId !== null) {
      if (isStaff && !assignedBuildingIds.includes(parsedBuildingId)) {
        throw new ForbiddenError('You do not have access to this building');
      }

      // Verify building exists
      const buildingExists = await db
        .select({ id: buildings.id })
        .from(buildings)
        .where(eq(buildings.id, parsedBuildingId))
        .limit(1);

      if (buildingExists.length === 0) {
        throw new NotFoundError('Building not found');
      }

      const result = await db
        .select()
        .from(rooms)
        .where(eq(rooms.buildingId, parsedBuildingId));

      res.json(result);
      return;
    }

    // If STAFF, return rooms from assigned buildings only
    if (isStaff) {
      if (assignedBuildingIds.length === 0) {
        res.json([]);
        return;
      }

      const result = await db
        .select()
        .from(rooms)
        .where(inArray(rooms.buildingId, assignedBuildingIds));

      res.json(result);
      return;
    }

    // ADMIN gets all rooms
    const result = await db.select().from(rooms);
    res.json(result);
  }

  async getById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const roomId = Number(id);

    const result = await db
      .select()
      .from(rooms)
      .where(eq(rooms.id, roomId))
      .limit(1);

    if (result.length === 0) {
      throw new NotFoundError('Room not found');
    }

    const room = result[0]!;

    if (
      req.user?.role === 'STAFF' &&
      !(await isBuildingAssignedToStaff(req.user.id, room.buildingId))
    ) {
      throw new ForbiddenError('You do not have access to this building');
    }

    res.json(room);
  }

  async getAvailability(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { startAt, endAt } = req.query;

    const roomId = Number(id);

    const startAtDate = new Date(startAt as string);
    const endAtDate = new Date(endAt as string);

    // Verify room exists
    const roomRows = await db
      .select({
        id: rooms.id,
        buildingId: rooms.buildingId,
      })
      .from(rooms)
      .where(eq(rooms.id, roomId))
      .limit(1);

    if (roomRows.length === 0) {
      throw new NotFoundError('Room not found');
    }

    const room = roomRows[0]!;

    if (
      req.user?.role === 'STAFF' &&
      !(await isBuildingAssignedToStaff(req.user.id, room.buildingId))
    ) {
      throw new ForbiddenError('You do not have access to this building');
    }

    const overlappingBookings = await db
      .select({
        id: bookings.id,
        startAt: bookings.startAt,
        endAt: bookings.endAt,
      })
      .from(bookings)
      .where(
        and(
          eq(bookings.roomId, roomId),
          lt(bookings.startAt, endAtDate),
          gt(bookings.endAt, startAtDate),
        ),
      );

    res.json(overlappingBookings);
  }

  async getRoomDayAvailability(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { date } = req.query;

    const roomId = Number(id);

    // Verify room exists and check RBAC
    const roomRows = await db
      .select({
        id: rooms.id,
        name: rooms.name,
        buildingId: rooms.buildingId,
      })
      .from(rooms)
      .where(eq(rooms.id, roomId))
      .limit(1);

    if (roomRows.length === 0) {
      throw new NotFoundError('Room not found');
    }

    const room = roomRows[0]!;

    if (
      req.user?.role === 'STAFF' &&
      !(await isBuildingAssignedToStaff(req.user.id, room.buildingId))
    ) {
      throw new ForbiddenError('You do not have access to this building');
    }

    // Get staff building IDs if needed for RBAC
    const staffBuildingIds =
      req.user?.role === 'STAFF'
        ? await getAssignedBuildingIdsForStaff(req.user.id)
        : [];

    // Query availability with RBAC filtering
    const availability = await getRoomDayAvailabilityQuery(
      roomId,
      date as string,
      {
        id: req.user!.id,
        role: req.user!.role as
          | 'ADMIN'
          | 'STAFF'
          | 'FACULTY'
          | 'STUDENT'
          | 'PENDING_ROLE',
        staffBuildingIds,
      }
    );

    res.json(availability);
  }

  async create(req: Request, res: Response): Promise<void> {
    const { name, buildingId } = req.body;

    if (
      req.user?.role === 'STAFF' &&
      !(await isBuildingAssignedToStaff(req.user.id, buildingId))
    ) {
      throw new ForbiddenError('You do not have access to this building');
    }

    try {
      const result = await db
        .insert(rooms)
        .values({ name, buildingId })
        .returning();

      res.status(201).json(result[0]);
    } catch (error: any) {
      if (error?.cause?.code === '23505') {
        throw new ConflictError(
          'Room already exists in this building'
        );
      }

      if (error?.cause?.code === '23503') {
        throw new ValidationError('Invalid buildingId');
      }

      throw error;
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { name } = req.body;

    const roomId = Number(id);

    const existing = await db
      .select({ id: rooms.id, buildingId: rooms.buildingId })
      .from(rooms)
      .where(eq(rooms.id, roomId))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundError('Room not found');
    }

    const room = existing[0]!;

    if (
      req.user?.role === 'STAFF' &&
      !(await isBuildingAssignedToStaff(req.user.id, room.buildingId))
    ) {
      throw new ForbiddenError('You do not have access to this building');
    }

    try {
      const result = await db
        .update(rooms)
        .set({ name })
        .where(eq(rooms.id, roomId))
        .returning();

      res.json(result[0]);
    } catch (error: any) {
      if (error?.cause?.code === '23505') {
        throw new ConflictError(
          'Room with this name already exists in the building'
        );
      }

      throw error;
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const roomId = Number(id);

    const existing = await db
      .select({ id: rooms.id, buildingId: rooms.buildingId })
      .from(rooms)
      .where(eq(rooms.id, roomId))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundError('Room not found');
    }

    const room = existing[0]!;

    if (
      req.user?.role === 'STAFF' &&
      !(await isBuildingAssignedToStaff(req.user.id, room.buildingId))
    ) {
      throw new ForbiddenError('You do not have access to this building');
    }

    await db.delete(rooms).where(eq(rooms.id, roomId));

    res.status(204).send();
  }
}
