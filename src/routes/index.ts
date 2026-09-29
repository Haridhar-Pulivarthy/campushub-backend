/**
 * API router — aggregates feature routers under the versioned API prefix.
 * Route definitions/mappings only.
 */
import { Router } from "express";

import { healthRouter } from "./health.routes.js";
import { reservationRouter } from "./reservation.routes.js";

const apiRouter: Router = Router();

apiRouter.use(healthRouter);
apiRouter.use(reservationRouter);

export { apiRouter };
