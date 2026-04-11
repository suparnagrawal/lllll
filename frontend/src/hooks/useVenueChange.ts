import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as venueChangeApi from "../lib/api/venueChange";
import { queryConfigs } from "../lib/queryConfig";
import type {
  ChangeRequestStatus,
  VenueChangeBatchCreateInput,
  VenueChangeCreateInput,
  VenueChangeValidateInput,
} from "../lib/api/types";

export function useVenueChangeOptions(enabled = true) {
  return useQuery({
    queryKey: ["venue-change-options"],
    queryFn: () => venueChangeApi.getVenueChangeOptions(),
    enabled,
    ...queryConfigs.venueChangeOptions,
  });
}

export function useVenueChangeRequests(status?: ChangeRequestStatus) {
  return useQuery({
    queryKey: ["venue-change-requests", status],
    queryFn: () => venueChangeApi.getVenueChangeRequests(status),
    ...queryConfigs.venueChangeRequests,
  });
}

export function useVenueChangeRequest(id?: number, enabled = true) {
  return useQuery({
    queryKey: ["venue-change-request", id],
    queryFn: () => venueChangeApi.getVenueChangeRequest(id as number),
    enabled: enabled && typeof id === "number",
    ...queryConfigs.venueChangeRequests,
  });
}

export function useVenueSuggestions(
  bookingId?: number,
  options?: { courseId?: number; buildingId?: number },
  enabled = true
) {
  return useQuery({
    queryKey: [
      "venue-suggestions",
      bookingId,
      options?.courseId,
      options?.buildingId,
    ],
    queryFn: () => venueChangeApi.getVenueSuggestions(bookingId as number, options),
    enabled: enabled && typeof bookingId === "number",
    ...queryConfigs.venueChangeOptions,
  });
}

export function useCreateVenueChangeRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: VenueChangeCreateInput) => venueChangeApi.createVenueChangeRequest(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["venue-change-requests"] });
      queryClient.invalidateQueries({ queryKey: ["venue-change-options"] });
    },
  });
}

export function useCreateVenueChangeBatchRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: VenueChangeBatchCreateInput) =>
      venueChangeApi.createVenueChangeBatchRequest(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["venue-change-requests"] });
      queryClient.invalidateQueries({ queryKey: ["venue-change-options"] });
    },
  });
}

export function useApproveVenueChangeRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reviewNote }: { id: number; reviewNote?: string }) =>
      venueChangeApi.approveVenueChangeRequest(id, reviewNote),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["venue-change-requests"] });
    },
  });
}

export function useRejectVenueChangeRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reviewNote }: { id: number; reviewNote: string }) =>
      venueChangeApi.rejectVenueChangeRequest(id, reviewNote),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["venue-change-requests"] });
    },
  });
}

export function useCancelVenueChangeRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => venueChangeApi.cancelVenueChangeRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["venue-change-requests"] });
    },
  });
}

export function useValidateVenueChangeRequest() {
  return useMutation({
    mutationFn: (input: VenueChangeValidateInput) =>
      venueChangeApi.validateVenueChangeRequest(input),
  });
}
