/**
 * Reservation controller — HTTP request/response handling only.
 *
 * Reads inputs from the request, awaits the reservation service, and shapes
 * every HTTP response (status code + body). No DB access and no business
 * logic here. Domain errors from the service are mapped to 400/404/409; any
 * unexpected error is logged and answered with a 500 ErrorResponse.
 */
import type { Request, Response } from "express";

import {
  ConflictError,
  NotFoundError,
  ValidationError,
  cancelReservation as cancelReservationService,
  coerceStatus,
  createReservation as createReservationService,
  getUserReservations as getUserReservationsService,
} from "../services/reservation.service.js";
import type { ErrorResponse } from "../types/reservation.js";

function errorBody(code: string, message: string): ErrorResponse {
  return { code, message };
}

/** Log an unexpected error server-side and respond with a generic 500. */
function sendInternalError(res: Response, err: unknown): void {
  console.error(err);
  res.status(500).json(errorBody("INTERNAL_ERROR", "Internal Server Error"));
}

/** POST /reservations — create a reservation. */
export async function createReservation(
  req: Request,
  res: Response,
): Promise<void> {
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
    const created = await createReservationService({
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
    sendInternalError(res, err);
  }
}

/** PATCH /reservations/:id/cancel — cancel a reservation (idempotent). */
export async function cancelReservation(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const id = req.params["id"];
    if (typeof id !== "string" || id.trim() === "") {
      res
        .status(400)
        .json(errorBody("INVALID_RESERVATION_ID", "id is required"));
      return;
    }
    res.status(200).json(await cancelReservationService(id));
  } catch (err) {
    if (err instanceof ValidationError) {
      res.status(400).json(errorBody("INVALID_RESERVATION_ID", err.message));
      return;
    }
    if (err instanceof NotFoundError) {
      res.status(404).json(errorBody("RESERVATION_NOT_FOUND", err.message));
      return;
    }
    sendInternalError(res, err);
  }
}

/** GET /reservations/user/:userId — active reservations for a user. */
export async function getUserReservations(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const userId = req.params["userId"];
    if (typeof userId !== "string" || userId.trim() === "") {
      res.status(400).json(errorBody("INVALID_USER_ID", "userId is required"));
      return;
    }
    res.status(200).json(await getUserReservationsService(userId));
  } catch (err) {
    if (err instanceof ValidationError) {
      res.status(400).json(errorBody("INVALID_USER_ID", err.message));
      return;
    }
    sendInternalError(res, err);
  }
}
