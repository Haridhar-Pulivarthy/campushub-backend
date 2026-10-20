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
  parseAvailability,
} from "../services/resource.service.js";
import type { ErrorResponse, ResourceType } from "../types/reservation.js";

function errorBody(code: string, message: string): ErrorResponse {
  return { code, message };
}

/** Log an unexpected error server-side and respond with a generic 500. */
function sendInternalError(res: Response, err: unknown): void {
  console.error(err);
  res.status(500).json(errorBody("INTERNAL_ERROR", "Internal Server Error"));
}

/** GET /resources — optional `type` and `isAvailable` query filters. */
export async function listResources(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const rawType = req.query["type"];
    let type: ResourceType | undefined;
    if (rawType !== undefined) {
      if (typeof rawType !== "string" || !isResourceType(rawType)) {
        res
          .status(400)
          .json(
            errorBody(
              "INVALID_TYPE",
              "type must be one of ROOM, EQUIPMENT, LAB",
            ),
          );
        return;
      }
      type = rawType;
    }

    const rawIsAvailable = req.query["isAvailable"];
    let isAvailable: boolean | undefined;
    if (rawIsAvailable !== undefined) {
      isAvailable =
        typeof rawIsAvailable === "string"
          ? parseAvailability(rawIsAvailable)
          : undefined;
      if (isAvailable === undefined) {
        res
          .status(400)
          .json(
            errorBody(
              "INVALID_IS_AVAILABLE",
              "isAvailable must be true or false",
            ),
          );
        return;
      }
    }

    res.status(200).json(
      await listResourcesService({
        ...(type !== undefined ? { type } : {}),
        ...(isAvailable !== undefined ? { isAvailable } : {}),
      }),
    );
  } catch (err) {
    sendInternalError(res, err);
  }
}
