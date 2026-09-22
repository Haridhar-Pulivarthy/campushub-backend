/**
 * Health routes — route definitions only.
 *
 * Wires HTTP method + path to the controller handler. No parsing, no logic,
 * no DB access.
 */
import { Router } from "express";

import { healthCheck } from "../controllers/health.controller.js";

const healthRouter: Router = Router();

healthRouter.get("/health", healthCheck);

export { healthRouter };
