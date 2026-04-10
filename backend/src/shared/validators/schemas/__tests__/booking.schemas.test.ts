import { describe, expect, it } from 'vitest';
import { bulkCreateBookingSchema, createBookingSchema } from '../booking.schemas';

describe('booking schemas', () => {
  it('keeps optional courseId for create booking payload', () => {
    const parsed = createBookingSchema.parse({
      roomId: 12,
      courseId: 44,
      startAt: '2026-04-11T08:00:00.000Z',
      endAt: '2026-04-11T09:00:00.000Z',
    });

    expect(parsed.courseId).toBe(44);
  });

  it('keeps optional courseId for bulk booking payload items', () => {
    const parsed = bulkCreateBookingSchema.parse({
      items: [
        {
          roomId: 5,
          courseId: 101,
          startAt: '2026-04-11T10:00:00.000Z',
          endAt: '2026-04-11T11:00:00.000Z',
          clientRowId: 'row-1',
        },
      ],
    });

    expect(parsed.items[0]?.courseId).toBe(101);
  });
});
