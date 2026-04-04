import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as buildingsApi from '../lib/api/buildings';

export function useBuildings() {
  return useQuery({
    queryKey: ['buildings'],
    queryFn: () => buildingsApi.getBuildings(),
  });
}

export function useCreateBuilding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => buildingsApi.createBuilding(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buildings'] });
    },
  });
}

export function useUpdateBuilding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      buildingsApi.updateBuilding(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buildings'] });
    },
  });
}

export function useDeleteBuilding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: buildingsApi.deleteBuilding,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buildings'] });
    },
  });
}
