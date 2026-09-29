/**
 * Reservation controller — HTTP request/response handling only.
 *
 * Reads inputs from the request, delegates to the reservation service, and
 * shapes the HTTP response (status code + body). No DB access and no business
 * logic here. Domain errors from the service are mapped to HTTP status codes;
 * unexpected errors are forwarded to Express error middleware via next().
 */
import type { Request, Response, NextFunction } from "express";

import {
  ConflictError,
  ValidationError,
  coerceStatus,
  createReservation as createReservationService,
  getUserReservations as getUserReservationsService,
  isResourceType,
  listResources as listResourcesService,
} from "../services/reservation.service.js";
import type { ErrorResponse } from "../types/reservation.js";

function errorBody(code: string, message: string): ErrorResponse {
  return { code, message };
}

/** GET /resources — optional `type` query filter. */
export function listResources(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  try {
    const rawType = req.query["type"];
    if (rawType === undefined) {
      res.status(200).json(listResourcesService());
      return;
    }
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
    res.status(200).json(listResourcesService(rawType));
  } catch (err) {
    next(err);
  }
}

/** POST /reservations — create a reservation. */
export function createReservation(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  try {
    const body: unknown = req.body;
    if (typeof body !== "object" || body === null) {
      res
        .status(400)
        .json(errorBody("INVALID_BODY", "Request body must be a JSON object"));
      return;
    }

    const record = body as Record<string, unknown>;
    const { resourceId, userId, startTime, endTime } = record;
    if (
      typeof resourceId !== "string" ||
      typeof userId !== "string" ||
      typeof startTime !== "string" ||
      typeof endTime !== "string"
    ) {
      res
        .status(400)
        .json(
          errorBody(
            "INVALID_BODY",
            "resourceId, userId, startTime, and endTime are required strings",
          ),
        );
      return;
    }

    const status = coerceStatus(record["status"]);
    const created = createReservationService({
      resourceId,
      userId,
      startTime,
      endTime,
      ...(status !== undefined ? { status } : {}),
    });
    res.status(201).json(created);
  } catch (err) {
    if (err instanceof ValidationError) {
      res.status(400).json(errorBody("INVALID_RESERVATION", err.message));
      return;
    }
    if (err instanceof ConflictError) {
      res.status(409).json(errorBody("RESERVATION_CONFLICT", err.message));
      return;
    }
    next(err);
  }
}

/** GET /reservations/user/:userId — active reservations for a user. */
export function getUserReservations(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  try {
    const userId = req.params["userId"];
    if (typeof userId !== "string" || userId.trim() === "") {
      res
        .status(400)
        .json(errorBody("INVALID_USER_ID", "userId is required"));
      return;
    }
    res.status(200).json(getUserReservationsService(userId));
  } catch (err) {
    if (err instanceof ValidationError) {
      res.status(400).json(errorBody("INVALID_USER_ID", err.message));
      return;
    }
    next(err);
  }
}
