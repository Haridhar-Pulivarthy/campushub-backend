/**
 * Reservation controller — HTTP request/response handling only.
 *
 * Reads and shape-checks inputs from the request, awaits the reservation
 * service, and sends the success response. No DB access and no business
 * logic here. Malformed requests throw a ValidationError; those and the
 * service's domain errors propagate (Express 5 forwards rejected handlers)
 * to the centralized error middleware, which formats every error response.
 */
import type { Request, Response } from "express";

import { ValidationError } from "../services/errors.js";
import {
  cancelReservation as cancelReservationService,
  coerceStatus,
  createReservation as createReservationService,
  getUserReservations as getUserReservationsService,
} from "../services/reservation.service.js";

/** POST /reservations — create a reservation. */
export async function createReservation(
  req: Request,
  res: Response,
): Promise<void> {
  const body: unknown = req.body;
  if (typeof body !== "object" || body === null) {
    throw new ValidationError(
      "INVALID_BODY",
      "Request body must be a JSON object",
    );
  }

  const record = body as Record<string, unknown>;
  const { resourceId, userId, startTime, endTime } = record;
  if (
    typeof resourceId !== "string" ||
    typeof userId !== "string" ||
    typeof startTime !== "string" ||
    typeof endTime !== "string"
  ) {
    throw new ValidationError(
      "INVALID_BODY",
      "resourceId, userId, startTime, and endTime are required strings",
    );
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
}

/** PATCH /reservations/:id/cancel — cancel a reservation (idempotent). */
export async function cancelReservation(
  req: Request,
  res: Response,
): Promise<void> {
  const id = req.params["id"];
  if (typeof id !== "string" || id.trim() === "") {
    throw new ValidationError("INVALID_RESERVATION_ID", "id is required");
  }
  res.status(200).json(await cancelReservationService(id));
}

/** GET /reservations/user/:userId — active reservations for a user. */
export async function getUserReservations(
  req: Request,
  res: Response,
): Promise<void> {
  const userId = req.params["userId"];
  if (typeof userId !== "string" || userId.trim() === "") {
    throw new ValidationError("INVALID_USER_ID", "userId is required");
  }
  res.status(200).json(await getUserReservationsService(userId));
}
