import { z } from 'zod';

export const createRoomSchema = z.object({
  name: z.string().min(1, 'name is required').trim(),
  buildingId: z.number().int().positive('buildingId must be a positive integer'),
});

export const updateRoomSchema = z.object({
  name: z.string().min(1, 'name is required').trim().optional(),
});

export const listRoomsSchema = z.object({
  buildingId: z.string()
    .optional()
    .transform((val) => val ? Number(val) : undefined)
    .refine((val) => val === undefined || (Number.isInteger(val) && val > 0), {
      message: 'buildingId must be a positive integer',
    }),
});

export const roomAvailabilitySchema = z.object({
  startAt: z.string().datetime('startAt must be a valid datetime string'),
  endAt: z.string().datetime('endAt must be a valid datetime string'),
}).refine((data) => {
  const start = new Date(data.startAt);
  const end = new Date(data.endAt);
  return start < end;
}, {
  message: 'startAt must be before endAt',
  path: ['startAt'],
});

export type CreateRoom = z.infer<typeof createRoomSchema>;
export type UpdateRoom = z.infer<typeof updateRoomSchema>;
export type ListRoomsQuery = z.infer<typeof listRoomsSchema>;
export type RoomAvailabilityQuery = z.infer<typeof roomAvailabilitySchema>;
