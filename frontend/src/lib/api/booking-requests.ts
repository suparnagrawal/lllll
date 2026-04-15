import { request } from "./client";
import type { BookingRequest, BookingStatus, BookingEventType } from "./types";

type GetBookingRequestsOptions = {
  status?: BookingStatus;
  limit?: number;
};

export async function getBookingRequests(
  statusOrOptions?: BookingStatus | GetBookingRequestsOptions,
): Promise<BookingRequest[]> {
  const options: GetBookingRequestsOptions =
    typeof statusOrOptions === "string"
      ? { status: statusOrOptions }
      : (statusOrOptions ?? {});

  const params = new URLSearchParams();
  if (options.status) {
    params.set("status", options.status);
  }
  if (options.limit !== undefined) {
    params.set("limit", String(options.limit));
  }

  const query = params.toString();
  const requests = await request<BookingRequest[]>(
    `/booking-requests${query ? `?${query}` : ""}`,
  );

  return [...requests].sort((a, b) => {
    const aTime = Date.parse(a.createdAt);
    const bTime = Date.parse(b.createdAt);

    if (!Number.isNaN(aTime) && !Number.isNaN(bTime) && bTime !== aTime) {
      return bTime - aTime;
    }

    return b.id - a.id;
  });
}

export async function createBookingRequest(input: {
  roomId: number;
  startAt: string;
  endAt: string;
  eventType: BookingEventType;
  purpose: string;
  participantCount?: number;
  facultyId?: number;
  overrideHolidayWarning?: boolean;
}): Promise<BookingRequest> {
  return request<BookingRequest>("/booking-requests", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function approveBookingRequest(
  id: number,
  input?: { overrideHolidayWarning?: boolean },
): Promise<void> {
  await request<unknown>(`/booking-requests/${id}/approve`, {
    method: "POST",
    body: JSON.stringify(input ?? {}),
  });
}

export async function forwardBookingRequest(id: number): Promise<void> {
  await request<unknown>(`/booking-requests/${id}/forward`, {
    method: "POST",
  });
}

export async function rejectBookingRequest(id: number): Promise<void> {
  await request<unknown>(`/booking-requests/${id}/reject`, {
    method: "POST",
  });
}

export async function cancelBookingRequest(id: number): Promise<void> {
  await request<unknown>(`/booking-requests/${id}/cancel`, {
    method: "POST",
  });
}
