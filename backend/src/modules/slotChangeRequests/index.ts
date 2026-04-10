import slotChangeRequestsRouter from "./api/router";
import type { ApiModule } from "../module.types";

export const slotChangeRequestsModule: ApiModule = {
  key: "slotChangeRequests",
  basePath: "/slot-change-requests",
  router: slotChangeRequestsRouter,
};
