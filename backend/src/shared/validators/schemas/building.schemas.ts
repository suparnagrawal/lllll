import { z } from 'zod';

export const createBuildingSchema = z.object({
  name: z.string().min(1, 'name is required').trim(),
});

export const updateBuildingSchema = z.object({
  name: z.string().min(1, 'name is required').trim().optional(),
});

export type CreateBuilding = z.infer<typeof createBuildingSchema>;
export type UpdateBuilding = z.infer<typeof updateBuildingSchema>;
