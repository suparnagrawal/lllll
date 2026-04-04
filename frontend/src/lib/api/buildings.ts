import { request } from "./client";
import type { Building } from "./types";

export async function getBuildings(): Promise<Building[]> {
  return request<Building[]>("/buildings");
}

export async function createBuilding(name: string): Promise<Building> {
  return request<Building>("/buildings", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function updateBuilding(id: number, name: string): Promise<Building> {
  return request<Building>(`/buildings/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

export async function deleteBuilding(id: number): Promise<void> {
  await request<{ message: string }>(`/buildings/${id}`, {
    method: "DELETE",
  });
}
