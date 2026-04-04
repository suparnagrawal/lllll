import { useQuery } from "@tanstack/react-query";
import {
  getAvailability,
  getBuildings,
  getRooms,
} from "../lib/api";
import { queryConfigs } from "../lib/queryConfig";

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
    ...queryConfigs.availability,
  });
}

export function useBuildings() {
  return useQuery({
    queryKey: ["buildings"],
    queryFn: () => getBuildings(),
    ...queryConfigs.buildings,
  });
}

export function useRooms(buildingId?: number, enabled = true) {
  return useQuery({
    queryKey: ["rooms", buildingId],
    queryFn: () => getRooms(buildingId),
    enabled: enabled && buildingId !== undefined,
    ...queryConfigs.rooms,
  });
}
