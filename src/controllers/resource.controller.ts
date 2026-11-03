/**
 * Resource controller — HTTP request/response handling only.
 *
 * Reads and validates query inputs, delegates to the resource service, and
 * sends the success response. Invalid filters throw a ValidationError; all
 * errors propagate to the centralized error middleware. No DB access and no
 * business logic here.
 */
import type { Request, Response } from "express";

import type { ResourceType } from "../../shared/api.js";
import { ValidationError } from "../services/errors.js";
import {
  isResourceType,
  listResources as listResourcesService,
  parseAvailability,
} from "../services/resource.service.js";

/** GET /resources — optional `type` and `isAvailable` query filters. */
export async function listResources(
  req: Request,
  res: Response,
): Promise<void> {
  const rawType = req.query["type"];
  let type: ResourceType | undefined;
  if (rawType !== undefined) {
    if (typeof rawType !== "string" || !isResourceType(rawType)) {
      throw new ValidationError(
        "INVALID_TYPE",
        "type must be one of ROOM, EQUIPMENT, LAB",
      );
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
      throw new ValidationError(
        "INVALID_IS_AVAILABLE",
        "isAvailable must be true or false",
      );
    }
  }

  res.status(200).json(
    await listResourcesService({
      ...(type !== undefined ? { type } : {}),
      ...(isAvailable !== undefined ? { isAvailable } : {}),
    }),
  );
}
