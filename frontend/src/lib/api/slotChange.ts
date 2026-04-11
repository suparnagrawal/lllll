import { request } from "./client";
import type {
  ChangeRequestBatchCreateResponse,
  ChangeRequestActionResponse,
  ChangeRequestStatus,
  SlotChangeBatchCreateInput,
  SlotChangeCreateInput,
  SlotChangeCreateResponse,
  SlotChangeRequestDetail,
  SlotChangeOptionsResponse,
  SlotChangeRequestListItem,
  SlotChangeValidateInput,
  SlotChangeValidationResponse,
} from "./types";

export async function getSlotChangeOptions(): Promise<SlotChangeOptionsResponse> {
  return request<SlotChangeOptionsResponse>("/slot-change-requests/options");
}

export async function getSlotChangeRequests(
  status?: ChangeRequestStatus
): Promise<SlotChangeRequestListItem[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return request<SlotChangeRequestListItem[]>(`/slot-change-requests${query}`);
}

export async function getSlotChangeRequest(id: number): Promise<SlotChangeRequestDetail> {
  return request<SlotChangeRequestDetail>(`/slot-change-requests/${id}`);
}

export async function createSlotChangeRequest(
  input: SlotChangeCreateInput
): Promise<SlotChangeCreateResponse> {
  return request<SlotChangeCreateResponse>("/slot-change-requests", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function createSlotChangeBatchRequest(
  input: SlotChangeBatchCreateInput
): Promise<ChangeRequestBatchCreateResponse> {
  return request<ChangeRequestBatchCreateResponse>("/slot-change-requests/batch", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function approveSlotChangeRequest(
  id: number,
  reviewNote?: string
): Promise<ChangeRequestActionResponse> {
  return request<ChangeRequestActionResponse>(`/slot-change-requests/${id}/approve`, {
    method: "POST",
    body: JSON.stringify(reviewNote ? { reviewNote } : {}),
  });
}

export async function rejectSlotChangeRequest(
  id: number,
  reviewNote: string
): Promise<ChangeRequestActionResponse> {
  return request<ChangeRequestActionResponse>(`/slot-change-requests/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ reviewNote }),
  });
}

export async function cancelSlotChangeRequest(
  id: number
): Promise<ChangeRequestActionResponse> {
  return request<ChangeRequestActionResponse>(`/slot-change-requests/${id}/cancel`, {
    method: "POST",
  });
}

export async function validateSlotChangeRequest(
  input: SlotChangeValidateInput
): Promise<SlotChangeValidationResponse> {
  return request<SlotChangeValidationResponse>("/slot-change-requests/validate", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
