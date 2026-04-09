import { request } from "./client";

export type UserProfile = {
  id: number;
  name: string;
  email: string;
  role: string;
  department: string | null;
  avatarUrl: string | null;
  registeredVia: string;
  isActive: boolean;
  createdAt: string;
};

export type UpdateProfileInput = {
  department?: string | null;
};

export async function getCurrentUserProfile(): Promise<UserProfile> {
  return request<UserProfile>("/users/profile");
}

export async function updateUserProfile(
  input: UpdateProfileInput,
): Promise<UserProfile> {
  return request<UserProfile>("/users/profile", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteUserAccount(): Promise<void> {
  await request<{ ok: boolean }>("/users/profile", {
    method: "DELETE",
  });
}

export type ActivityLog = {
  id: string;
  type: "LOGIN" | "BOOKING" | "ACTION";
  title: string;
  description: string;
  timestamp: string;
  metadata?: {
    ipAddress?: string;
    device?: string;
    bookingId?: number;
  };
};

export async function getUserActivityLog(
  _userId: number,
  _limit: number = 10,
): Promise<ActivityLog[]> {
  // This endpoint doesn't exist yet on the backend
  // For now, return mock data
  return Promise.resolve([]);
}

export type Session = {
  id: string;
  deviceName: string;
  lastAccessedAt: string;
  ipAddress: string;
  isCurrent: boolean;
};

export async function getUserSessions(_userId: number): Promise<Session[]> {
  // This endpoint doesn't exist yet on the backend
  // For now, return mock data
  return Promise.resolve([]);
}

export async function signOutOtherSessions(_userId: number): Promise<void> {
  // This endpoint doesn't exist yet on the backend
  // For now, return success
  return Promise.resolve();
}

export type UserData = {
  user: UserProfile;
  bookings: Array<{
    id: number;
    title: string;
    status: string;
    createdAt: string;
  }>;
  requests: Array<{
    id: number;
    title: string;
    status: string;
    createdAt: string;
  }>;
};

export async function exportUserData(_userId: number): Promise<UserData> {
  const data = await request<{
    exportedAt: string;
    user: UserProfile;
    bookingRequests: Array<{ id: number; eventType: string; purpose: string; status: string; startAt: string; endAt: string; createdAt: string }>;
    approvedBookings: Array<{ id: number; roomId: number; startAt: string; endAt: string; source: string; approvedAt: string }>;
  }>("/users/profile/export");
  
  return {
    user: data.user,
    bookings: data.approvedBookings.map(b => ({
      id: b.id,
      title: `Room ${b.roomId}`,
      status: 'APPROVED',
      createdAt: b.approvedAt,
    })),
    requests: data.bookingRequests.map(br => ({
      id: br.id,
      title: br.purpose,
      status: br.status,
      createdAt: br.createdAt,
    })),
  };
}
