import { z } from 'zod';

export const createBookingSchema = z.object({
  roomId: z.number().int().positive('roomId must be a positive integer'),
  startAt: z.string().datetime('startAt must be a valid datetime string'),
  endAt: z.string().datetime('endAt must be a valid datetime string'),
  metadata: z.record(z.any()).optional(),
}).refine((data) => {
  const start = new Date(data.startAt);
  const end = new Date(data.endAt);
  return start < end;
}, {
  message: 'startAt must be before endAt',
  path: ['startAt'],
});

export const updateBookingSchema = z.object({
  roomId: z.number().int().positive('roomId must be a positive integer').optional(),
  startAt: z.string().datetime('startAt must be a valid datetime string').optional(),
  endAt: z.string().datetime('endAt must be a valid datetime string').optional(),
}).refine((data) => {
  if (data.startAt && data.endAt) {
    const start = new Date(data.startAt);
    const end = new Date(data.endAt);
    return start < end;
  }
  return true;
}, {
  message: 'startAt must be before endAt',
  path: ['startAt'],
});

export const listBookingsSchema = z.object({
  startAt: z.string().datetime('startAt must be a valid datetime string').optional(),
  endAt: z.string().datetime('endAt must be a valid datetime string').optional(),
  roomId: z.string()
    .optional()
    .transform((val) => val ? Number(val) : undefined)
    .refine((val) => val === undefined || (Number.isInteger(val) && val > 0), {
      message: 'roomId must be a positive integer',
    }),
  buildingId: z.string()
    .optional()
    .transform((val) => val ? Number(val) : undefined)
    .refine((val) => val === undefined || (Number.isInteger(val) && val > 0), {
      message: 'buildingId must be a positive integer',
    }),
}).refine((data) => {
  if (data.startAt && data.endAt) {
    const start = new Date(data.startAt);
    const end = new Date(data.endAt);
    return start < end;
  }
  if ((data.startAt && !data.endAt) || (!data.startAt && data.endAt)) {
    return false;
  }
  return true;
}, {
  message: 'Both startAt and endAt must be provided together, and startAt must be before endAt',
  path: ['startAt'],
});

export const bulkCreateBookingSchema = z.object({
  items: z.array(
    z.object({
      roomId: z.number().int().positive('roomId must be a positive integer'),
      startAt: z.string().datetime('startAt must be a valid datetime string'),
      endAt: z.string().datetime('endAt must be a valid datetime string'),
      metadata: z.record(z.any()).optional(),
      clientRowId: z.string().optional(),
    }).refine((data) => {
      const start = new Date(data.startAt);
      const end = new Date(data.endAt);
      return start < end;
    }, {
      message: 'startAt must be before endAt',
      path: ['startAt'],
    })
  ).min(1, 'items array must not be empty'),
});

export const pruneBookingsSchema = z.object({
  scope: z.string().default('all').refine(
    (val) => val === 'all' || val === 'slot-system',
    { message: "scope must be either 'all' or 'slot-system'" }
  ),
  slotSystemId: z.string()
    .optional()
    .transform((val) => val ? Number(val) : undefined)
    .refine((val) => val === undefined || (Number.isInteger(val) && val > 0), {
      message: 'slotSystemId must be a positive integer',
    }),
}).refine((data) => {
  if (data.scope === 'slot-system' && !data.slotSystemId) {
    return false;
  }
  return true;
}, {
  message: 'slotSystemId is required for scope=slot-system',
  path: ['slotSystemId'],
});
