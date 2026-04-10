import venueChangeRequestsRouter from "./api/router";
import type { ApiModule } from "../module.types";

export const venueChangeRequestsModule: ApiModule = {
  key: "venueChangeRequests",
  basePath: "/venue-change-requests",
  router: venueChangeRequestsRouter,
};
