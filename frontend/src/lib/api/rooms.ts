import { request } from "./client";
import type { Room } from "./types";

export async function getRooms(buildingId?: number): Promise<Room[]> {
  const query =
    buildingId === undefined ? "" : `?buildingId=${encodeURIComponent(String(buildingId))}`;
  return request<Room[]>(`/rooms${query}`);
}

export async function createRoom(name: string, buildingId: number): Promise<Room> {
  return request<Room>("/rooms", {
    method: "POST",
    body: JSON.stringify({ name, buildingId }),
  });
}

export async function updateRoom(id: number, name: string): Promise<Room> {
  const response = await request<{ data: Room }>(`/rooms/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
  return response.data;
}

export async function deleteRoom(id: number): Promise<void> {
  await request<{ message: string }>(`/rooms/${id}`, {
    method: "DELETE",
  });
}

export async function getRoomAvailability(
  roomId: number,
  startAt: string,
  endAt: string
): Promise<{ id: number; startAt: string; endAt: string }[]> {
  const params = new URLSearchParams({ startAt, endAt });
  return request(`/rooms/${roomId}/availability?${params.toString()}`);
}
