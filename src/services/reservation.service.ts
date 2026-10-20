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
import { ResourceModel, type IResource } from "../models/Resource.model.js";
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

/** Thrown when a referenced reservation does not exist. */
export class NotFoundError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
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

/** Statuses of existing reservations that block an overlapping booking. */
const BLOCKING_STATUSES: readonly ReservationStatus[] = ["PENDING", "CONFIRMED"];

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
 *   does not exist or is unavailable.
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

  const resource = await ResourceModel.findById(resourceObjectId)
    .select("isAvailable")
    .lean<Pick<IResource, "isAvailable">>()
    .exec();
  if (resource === null) {
    throw new ValidationError(`Unknown resourceId: ${resourceId}`);
  }
  if (!resource.isAvailable) {
    throw new ValidationError(`Resource ${resourceId} is not available`);
  }

  // Two intervals overlap when each starts before the other ends.
  const conflict = await ReservationModel.exists({
    resourceId: resourceObjectId,
    status: { $in: BLOCKING_STATUSES },
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
 * Cancel a reservation. Idempotent: an already-cancelled reservation is
 * returned unchanged.
 * @throws ValidationError when id is not a valid ObjectId.
 * @throws NotFoundError when no reservation has the given id.
 */
export async function cancelReservation(id: string): Promise<Reservation> {
  if (typeof id !== "string" || !OBJECT_ID_PATTERN.test(id)) {
    throw new ValidationError("id must be a valid ObjectId");
  }
  const reservationId = new Types.ObjectId(id);

  // Atomic transition: only a PENDING/CONFIRMED reservation is updated, and
  // only its status field is written.
  const cancelled = await ReservationModel.findOneAndUpdate(
    { _id: reservationId, status: { $in: BLOCKING_STATUSES } },
    { $set: { status: "CANCELLED" } },
    { returnDocument: "after" },
  )
    .lean<LeanReservation>()
    .exec();
  if (cancelled !== null) {
    return toReservation(cancelled);
  }

  // Nothing transitioned: either already cancelled or nonexistent.
  const existing = await ReservationModel.findById(reservationId)
    .lean<LeanReservation>()
    .exec();
  if (existing === null) {
    throw new NotFoundError(`Reservation ${id} not found`);
  }
  return toReservation(existing);
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
