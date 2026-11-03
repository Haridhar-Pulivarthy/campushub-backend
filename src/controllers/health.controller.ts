/**
 * Health controller — HTTP request/response handling only.
 *
 * Reads no persistence directly; delegates to the health service and shapes
 * the HTTP response. Anything thrown propagates to the centralized error
 * middleware.
 */
import type { Request, Response } from "express";

import { getHealthStatus } from "../services/health.service.js";

export function healthCheck(_req: Request, res: Response): void {
  res.status(200).json(getHealthStatus());
}
