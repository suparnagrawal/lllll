import { request } from "./client";
import type {
  ChangeRequestActionResponse,
  ChangeRequestStatus,
  VenueChangeCreateInput,
  VenueChangeCreateResponse,
  VenueChangeOptionsResponse,
  VenueChangeRequestListItem,
} from "./types";

export async function getVenueChangeOptions(): Promise<VenueChangeOptionsResponse> {
  return request<VenueChangeOptionsResponse>("/venue-change-requests/options");
}

export async function getVenueChangeRequests(
  status?: ChangeRequestStatus
): Promise<VenueChangeRequestListItem[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return request<VenueChangeRequestListItem[]>(`/venue-change-requests${query}`);
}

export async function createVenueChangeRequest(
  input: VenueChangeCreateInput
): Promise<VenueChangeCreateResponse> {
  return request<VenueChangeCreateResponse>("/venue-change-requests", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function approveVenueChangeRequest(
  id: number,
  reviewNote?: string
): Promise<ChangeRequestActionResponse> {
  return request<ChangeRequestActionResponse>(`/venue-change-requests/${id}/approve`, {
    method: "POST",
    body: JSON.stringify(reviewNote ? { reviewNote } : {}),
  });
}

export async function rejectVenueChangeRequest(
  id: number,
  reviewNote: string
): Promise<ChangeRequestActionResponse> {
  return request<ChangeRequestActionResponse>(`/venue-change-requests/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ reviewNote }),
  });
}

export async function cancelVenueChangeRequest(
  id: number
): Promise<ChangeRequestActionResponse> {
  return request<ChangeRequestActionResponse>(`/venue-change-requests/${id}/cancel`, {
    method: "POST",
  });
}
