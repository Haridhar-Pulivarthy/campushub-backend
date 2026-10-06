/**
 * Resource controller — HTTP request/response handling only.
 *
 * Reads and validates query inputs, delegates to the resource service, and
 * shapes every HTTP response (status code + body), including 500s for
 * unexpected errors. No DB access and no business logic here.
 */
import type { Request, Response } from "express";

import {
  isResourceType,
  listResources as listResourcesService,
} from "../services/resource.service.js";
import type { ErrorResponse } from "../types/reservation.js";

function errorBody(code: string, message: string): ErrorResponse {
  return { code, message };
}

/** Log an unexpected error server-side and respond with a generic 500. */
function sendInternalError(res: Response, err: unknown): void {
  console.error(err);
  res.status(500).json(errorBody("INTERNAL_ERROR", "Internal Server Error"));
}

/** GET /resources — optional `type` query filter. */
export async function listResources(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const rawType = req.query["type"];
    if (rawType === undefined) {
      res.status(200).json(await listResourcesService());
      return;
    }
    if (typeof rawType !== "string" || !isResourceType(rawType)) {
      res
        .status(400)
        .json(
          errorBody("INVALID_TYPE", "type must be one of ROOM, EQUIPMENT, LAB"),
        );
      return;
    }
    res.status(200).json(await listResourcesService(rawType));
  } catch (err) {
    sendInternalError(res, err);
  }
}
