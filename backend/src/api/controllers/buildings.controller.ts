import { Request, Response } from 'express';
import { db } from '../../db';
import { buildings, rooms } from '../../db/schema';
import { eq, inArray } from 'drizzle-orm';
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

export class BuildingsController {
  async list(req: Request, res: Response): Promise<void> {
    const isStaff = req.user?.role === 'STAFF';
    const assignedBuildingIds = isStaff
      ? await getAssignedBuildingIdsForStaff(req.user!.id)
      : [];

    if (isStaff) {
      if (assignedBuildingIds.length === 0) {
        res.json([]);
        return;
      }

      const result = await db
        .select()
        .from(buildings)
        .where(inArray(buildings.id, assignedBuildingIds));

      res.json(result);
      return;
    }

    const result = await db.select().from(buildings);
    res.json(result);
  }

  async getById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const buildingId = Number(id);

    if (
      req.user?.role === 'STAFF' &&
      !(await isBuildingAssignedToStaff(req.user.id, buildingId))
    ) {
      throw new ForbiddenError('You do not have access to this building');
    }

    const result = await db
      .select()
      .from(buildings)
      .where(eq(buildings.id, buildingId))
      .limit(1);

    if (result.length === 0) {
      throw new NotFoundError('Building not found');
    }

    res.json(result[0]);
  }

  async getRooms(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const buildingId = Number(id);

    if (
      req.user?.role === 'STAFF' &&
      !(await isBuildingAssignedToStaff(req.user.id, buildingId))
    ) {
      throw new ForbiddenError('You do not have access to this building');
    }

    const building = await db
      .select({ id: buildings.id })
      .from(buildings)
      .where(eq(buildings.id, buildingId))
      .limit(1);

    if (building.length === 0) {
      throw new NotFoundError('Building not found');
    }

    const result = await db
      .select()
      .from(rooms)
      .where(eq(rooms.buildingId, buildingId));

    res.json(result);
  }

  async create(req: Request, res: Response): Promise<void> {
    const { name } = req.body;

    try {
      const result = await db
        .insert(buildings)
        .values({ name })
        .returning();

      res.status(201).json(result[0]);
    } catch (error: any) {
      if (error?.cause?.code === '23505') {
        throw new ConflictError('Building already exists');
      }

      throw error;
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { name } = req.body;

    const buildingId = Number(id);

    if (
      req.user?.role === 'STAFF' &&
      !(await isBuildingAssignedToStaff(req.user.id, buildingId))
    ) {
      throw new ForbiddenError('You do not have access to this building');
    }

    try {
      const result = await db
        .update(buildings)
        .set({ name })
        .where(eq(buildings.id, buildingId))
        .returning();

      if (result.length === 0) {
        throw new NotFoundError('Building not found');
      }

      res.json(result[0]);
    } catch (error: any) {
      if (error?.cause?.code === '23505') {
        throw new ConflictError('Building already exists');
      }

      throw error;
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const buildingId = Number(id);

    if (
      req.user?.role === 'STAFF' &&
      !(await isBuildingAssignedToStaff(req.user.id, buildingId))
    ) {
      throw new ForbiddenError('You do not have access to this building');
    }

    try {
      const result = await db
        .delete(buildings)
        .where(eq(buildings.id, buildingId))
        .returning();

      if (result.length === 0) {
        throw new NotFoundError('Building not found');
      }

      res.status(204).send();
    } catch (error: any) {
      if (error?.cause?.code === '23503') {
        throw new ConflictError(
          'Cannot delete building with existing rooms'
        );
      }

      throw error;
    }
  }
}
