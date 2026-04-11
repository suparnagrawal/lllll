import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as slotChangeApi from "../lib/api/slotChange";
import { queryConfigs } from "../lib/queryConfig";
import type {
  ChangeRequestStatus,
  SlotChangeBatchCreateInput,
  SlotChangeCreateInput,
  SlotChangeValidateInput,
} from "../lib/api/types";

export function useSlotChangeOptions(enabled = true) {
  return useQuery({
    queryKey: ["slot-change-options"],
    queryFn: () => slotChangeApi.getSlotChangeOptions(),
    enabled,
    ...queryConfigs.slotChangeOptions,
  });
}

export function useSlotChangeRequests(status?: ChangeRequestStatus) {
  return useQuery({
    queryKey: ["slot-change-requests", status],
    queryFn: () => slotChangeApi.getSlotChangeRequests(status),
    ...queryConfigs.slotChangeRequests,
  });
}

export function useSlotChangeRequest(id?: number, enabled = true) {
  return useQuery({
    queryKey: ["slot-change-request", id],
    queryFn: () => slotChangeApi.getSlotChangeRequest(id as number),
    enabled: enabled && typeof id === "number",
    ...queryConfigs.slotChangeRequests,
  });
}

export function useCreateSlotChangeRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SlotChangeCreateInput) => slotChangeApi.createSlotChangeRequest(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["slot-change-requests"] });
      queryClient.invalidateQueries({ queryKey: ["slot-change-options"] });
    },
  });
}

export function useCreateSlotChangeBatchRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SlotChangeBatchCreateInput) =>
      slotChangeApi.createSlotChangeBatchRequest(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["slot-change-requests"] });
      queryClient.invalidateQueries({ queryKey: ["slot-change-options"] });
    },
  });
}

export function useApproveSlotChangeRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reviewNote }: { id: number; reviewNote?: string }) =>
      slotChangeApi.approveSlotChangeRequest(id, reviewNote),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["slot-change-requests"] });
    },
  });
}

export function useRejectSlotChangeRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reviewNote }: { id: number; reviewNote: string }) =>
      slotChangeApi.rejectSlotChangeRequest(id, reviewNote),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["slot-change-requests"] });
    },
  });
}

export function useCancelSlotChangeRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => slotChangeApi.cancelSlotChangeRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["slot-change-requests"] });
    },
  });
}

export function useValidateSlotChangeRequest() {
  return useMutation({
    mutationFn: (input: SlotChangeValidateInput) =>
      slotChangeApi.validateSlotChangeRequest(input),
  });
}
