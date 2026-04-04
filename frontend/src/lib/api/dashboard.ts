import { request } from "./client";
import type { DashboardStats, UpcomingBooking, ActivityItem } from "./types";

export async function getDashboardStats(): Promise<DashboardStats> {
  return request<DashboardStats>("/dashboard/stats");
}

export async function getUpcomingBookings(): Promise<UpcomingBooking[]> {
  return request<UpcomingBooking[]>("/dashboard/upcoming-bookings");
}

export async function getActivityFeed(): Promise<ActivityItem[]> {
  return request<ActivityItem[]>("/dashboard/activity-feed");
}

