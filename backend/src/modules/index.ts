import type { ApiModule } from "./module.types";
import { authModule } from "./auth";
import { availabilityModule } from "./availability";
import { bookingRequestsModule } from "./bookingRequests";
import { bookingsModule } from "./bookings";
import { buildingsModule } from "./buildings";
import { dashboardModule } from "./dashboard";
import { notificationsModule } from "./notifications";
import { roomsModule } from "./rooms";
import { slotChangeRequestsModule } from "./slotChangeRequests";
import { timetableModule } from "./timetable";
import { usersModule } from "./users";
import { venueChangeRequestsModule } from "./venueChangeRequests";

/**
 * Central feature-module registry.
 * Order is explicit and stable to keep runtime wiring deterministic.
 */
export const apiModules: ApiModule[] = [
  authModule,
  buildingsModule,
  roomsModule,
  bookingsModule,
  bookingRequestsModule,
  slotChangeRequestsModule,
  venueChangeRequestsModule,
  availabilityModule,
  usersModule,
  notificationsModule,
  timetableModule,
  dashboardModule,
];
