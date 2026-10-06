/**
 * Reservation service — business logic and data access for reservations.
 *
 * The only layer that queries the Reservation (and, for existence checks, the
 * Resource) models. Returns plain API-shaped data (per docs/openapi.yaml) to
 * controllers and throws typed domain errors for invalid input and scheduling
 * conflicts. No HTTP concerns (no `res`, no status codes) live here.
 */
import { Types } from "mongoose";

import {
  RESERVATION_STATUSES,
  ReservationModel,
  type IReservation,
} from "../models/Reservation.model.js";
import { ResourceModel } from "../models/Resource.model.js";
import type { Reservation, ReservationStatus } from "../types/reservation.js";

/** Thrown when input fails a domain validation rule. */
export class ValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/** Thrown when a reservation overlaps an existing one. */
export class ConflictError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

/** Fields a client may supply when creating a reservation. */
export interface CreateReservationInput {
  resourceId: string;
  userId: string;
  startTime: string;
  endTime: string;
  status?: ReservationStatus;
}

/** A lean Reservation document as returned by Mongoose queries. */
type LeanReservation = IReservation & { _id: Types.ObjectId };

const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

/** Type guard for the ReservationStatus enum. */
function isReservationStatus(value: string): value is ReservationStatus {
  return (RESERVATION_STATUSES as readonly string[]).includes(value);
}

/** Narrow an unknown status value to ReservationStatus, or throw. */
export function coerceStatus(value: unknown): ReservationStatus | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === "string" && isReservationStatus(value)) {
    return value;
  }
  throw new ValidationError("status must be PENDING, CONFIRMED, or CANCELLED");
}

/** Parse an ISO-8601 date-time string, throwing ValidationError if invalid. */
function parseInstant(value: string, field: string): Date {
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    throw new ValidationError(`${field} must be a valid ISO-8601 date-time`);
  }
  return new Date(ms);
}

/** Map a stored Reservation document to the API `Reservation` shape. */
function toReservation(doc: LeanReservation): Reservation {
  return {
    id: doc._id.toString(),
    resourceId: doc.resourceId.toString(),
    userId: doc.userId,
    startTime: doc.startTime.toISOString(),
    endTime: doc.endTime.toISOString(),
    status: doc.status,
  };
}

/**
 * Validate and persist a new reservation.
 * @throws ValidationError when fields are missing/malformed or the resource
 *   does not exist.
 * @throws ConflictError when the resource is already reserved for the range.
 */
export async function createReservation(
  input: CreateReservationInput,
): Promise<Reservation> {
  const { resourceId, userId, startTime, endTime, status } = input;

  if (typeof resourceId !== "string" || resourceId.trim() === "") {
    throw new ValidationError("resourceId is required");
  }
  if (!OBJECT_ID_PATTERN.test(resourceId)) {
    throw new ValidationError("resourceId must be a valid ObjectId");
  }
  if (typeof userId !== "string" || userId.trim() === "") {
    throw new ValidationError("userId is required");
  }

  const start = parseInstant(startTime, "startTime");
  const end = parseInstant(endTime, "endTime");
  if (start.getTime() >= end.getTime()) {
    throw new ValidationError("startTime must be before endTime");
  }

  const resourceObjectId = new Types.ObjectId(resourceId);

  const resource = await ResourceModel.exists({ _id: resourceObjectId }).exec();
  if (resource === null) {
    throw new ValidationError(`Unknown resourceId: ${resourceId}`);
  }

  // Two intervals overlap when each starts before the other ends.
  const conflict = await ReservationModel.exists({
    resourceId: resourceObjectId,
    status: { $ne: "CANCELLED" },
    startTime: { $lt: end },
    endTime: { $gt: start },
  }).exec();
  if (conflict !== null) {
    throw new ConflictError(
      `Resource ${resourceId} is already reserved for the requested time`,
    );
  }

  const created = await ReservationModel.create({
    resourceId: resourceObjectId,
    userId,
    startTime: start,
    endTime: end,
    status: status ?? "PENDING",
  });
  return toReservation(created.toObject<LeanReservation>());
}

/**
 * Return a user's active (non-cancelled) reservations.
 * @throws ValidationError when userId is missing.
 */
export async function getUserReservations(
  userId: string,
): Promise<Reservation[]> {
  if (typeof userId !== "string" || userId.trim() === "") {
    throw new ValidationError("userId is required");
  }
  const docs = await ReservationModel.find({
    userId,
    status: { $ne: "CANCELLED" },
  })
    .lean<LeanReservation[]>()
    .exec();
  return docs.map(toReservation);
}
