import { request } from "./client";
import type {
  ChangeRequestBatchCreateResponse,
  ChangeRequestActionResponse,
  ChangeRequestStatus,
  VenueChangeRequestDetail,
  VenueChangeValidationResponse,
  VenueChangeBatchCreateInput,
  VenueChangeCreateInput,
  VenueChangeCreateResponse,
  VenueChangeValidateInput,
  VenueChangeOptionsResponse,
  VenueChangeRequestListItem,
  VenueSuggestion,
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

export async function getVenueChangeRequest(id: number): Promise<VenueChangeRequestDetail> {
  return request<VenueChangeRequestDetail>(`/venue-change-requests/${id}`);
}

export async function createVenueChangeRequest(
  input: VenueChangeCreateInput
): Promise<VenueChangeCreateResponse> {
  return request<VenueChangeCreateResponse>("/venue-change-requests", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function createVenueChangeBatchRequest(
  input: VenueChangeBatchCreateInput
): Promise<ChangeRequestBatchCreateResponse> {
  return request<ChangeRequestBatchCreateResponse>("/venue-change-requests/batch", {
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

export async function getVenueSuggestions(
  bookingId: number,
  options?: { courseId?: number; buildingId?: number }
): Promise<VenueSuggestion[]> {
  const params = new URLSearchParams();

  if (options?.courseId !== undefined) {
    params.set("courseId", String(options.courseId));
  }

  if (options?.buildingId !== undefined) {
    params.set("buildingId", String(options.buildingId));
  }

  const query = params.toString();
  const suffix = query ? `?${query}` : "";

  return request<VenueSuggestion[]>(`/venue-change-requests/suggestions/${bookingId}${suffix}`);
}

export async function validateVenueChangeRequest(
  input: VenueChangeValidateInput
): Promise<VenueChangeValidationResponse> {
  return request<VenueChangeValidationResponse>("/venue-change-requests/validate", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
