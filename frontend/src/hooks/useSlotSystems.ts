import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as slotsApi from '../lib/api/slots';
import { queryConfigs } from '../lib/queryConfig';

export function useSlotSystems() {
  return useQuery({
    queryKey: ['slot-systems'],
    queryFn: () => slotsApi.getSlotSystems(),
    ...queryConfigs.slotSystems,
  });
}

export function useCreateSlotSystem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => slotsApi.createSlotSystem(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slot-systems'] });
    },
  });
}

export function useDeleteSlotSystem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (slotSystemId: number) => slotsApi.deleteSlotSystem(slotSystemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slot-systems'] });
    },
  });
}
