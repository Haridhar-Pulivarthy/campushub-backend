/**
 * Health controller — HTTP request/response handling only.
 *
 * Reads no persistence directly; delegates to the health service and shapes
 * the HTTP response. Errors are forwarded to Express error middleware.
 */
import type { Request, Response, NextFunction } from "express";

import { getHealthStatus } from "../services/health.service.js";

export function healthCheck(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  try {
    const status = getHealthStatus();
    res.status(200).json(status);
  } catch (err) {
    next(err);
  }
}
