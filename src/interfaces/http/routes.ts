import type { Express } from "express";

import type { AdminControllerDeps } from "./controllers/admin-controller.js";
import { buildAdminRouter } from "./controllers/admin-controller.js";
import type { AuthControllerDeps } from "./controllers/auth-controller.js";
import { buildAuthRouter } from "./controllers/auth-controller.js";
import type { HealthControllerDeps } from "./controllers/health-controller.js";
import { buildHealthRouter } from "./controllers/health-controller.js";

export interface MountRoutesDeps {
  authDeps: AuthControllerDeps;
  adminDeps: AdminControllerDeps;
  healthDeps: HealthControllerDeps;
}

export function mountRoutes(app: Express, deps: MountRoutesDeps): void {
  app.use("/v1/auth", buildAuthRouter(deps.authDeps));
  app.use("/v1/auth", buildAdminRouter(deps.adminDeps));
  app.use(buildHealthRouter(deps.healthDeps));
}
