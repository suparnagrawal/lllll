import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as bookingRequestsApi from '../lib/api/booking-requests';
import type { BookingStatus } from '../lib/api/types';

export function useBookingRequests(status?: BookingStatus) {
  return useQuery({
    queryKey: ['booking-requests', status],
    queryFn: () => bookingRequestsApi.getBookingRequests(status),
  });
}

export function useCreateBookingRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Parameters<typeof bookingRequestsApi.createBookingRequest>[0]) =>
      bookingRequestsApi.createBookingRequest(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-requests'] });
    },
  });
}

export function useApproveBookingRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: bookingRequestsApi.approveBookingRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-requests'] });
    },
  });
}

export function useForwardBookingRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: bookingRequestsApi.forwardBookingRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-requests'] });
    },
  });
}

export function useRejectBookingRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: bookingRequestsApi.rejectBookingRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-requests'] });
    },
  });
}

export function useCancelBookingRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: bookingRequestsApi.cancelBookingRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-requests'] });
    },
  });
}
