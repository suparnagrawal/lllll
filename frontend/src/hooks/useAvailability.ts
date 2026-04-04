import { useQuery } from "@tanstack/react-query";
import {
  getAvailability,
  getBuildings,
  getRooms,
} from "../lib/api";

export function useAvailability(
  startAt: string,
  endAt: string,
  buildingId?: number,
  enabled = true
) {
  return useQuery({
    queryKey: ["availability", startAt, endAt, buildingId],
    queryFn: () => getAvailability(startAt, endAt, buildingId),
    enabled: enabled && !!startAt && !!endAt,
    staleTime: 5 * 60 * 1000,
  });
}

export function useBuildings() {
  return useQuery({
    queryKey: ["buildings"],
    queryFn: () => getBuildings(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useRooms(buildingId?: number, enabled = true) {
  return useQuery({
    queryKey: ["rooms", buildingId],
    queryFn: () => getRooms(buildingId),
    enabled: enabled && buildingId !== undefined,
    staleTime: 5 * 60 * 1000,
  });
}
