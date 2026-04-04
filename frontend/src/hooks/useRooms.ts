import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as roomsApi from '../lib/api/rooms';

export function useRooms(buildingId?: number) {
  return useQuery({
    queryKey: ['rooms', buildingId],
    queryFn: () => roomsApi.getRooms(buildingId),
  });
}

export function useCreateRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ name, buildingId }: { name: string; buildingId: number }) =>
      roomsApi.createRoom(name, buildingId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rooms', variables.buildingId] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}

export function useUpdateRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => roomsApi.updateRoom(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}

export function useDeleteRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: roomsApi.deleteRoom,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}

export function useRoomAvailability(roomId: number, startAt?: string, endAt?: string) {
  return useQuery({
    queryKey: ['room-availability', roomId, startAt, endAt],
    queryFn: () => {
      if (!startAt || !endAt) throw new Error('startAt and endAt are required');
      return roomsApi.getRoomAvailability(roomId, startAt, endAt);
    },
    enabled: !!roomId && !!startAt && !!endAt,
  });
}
