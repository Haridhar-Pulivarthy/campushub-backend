/**
 * Reservation service — business logic and in-memory data store.
 *
 * This is the only layer that owns reservation/resource data (Lab 2 uses an
 * in-memory store; no database per project constraints). Returns plain domain
 * data to controllers and throws typed domain errors for invalid input and
 * scheduling conflicts. No HTTP concerns (no `res`, no status codes) live here.
 */
import { randomUUID } from "node:crypto";

import type {
  Reservation,
  ReservationStatus,
  Resource,
  ResourceType,
} from "../types/reservation.js";

/** Thrown when input fails a domain validation rule (maps to HTTP 400). */
export class ValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/** Thrown when a reservation overlaps an existing one (maps to HTTP 409). */
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

const RESOURCE_TYPES: readonly ResourceType[] = ["ROOM", "EQUIPMENT", "LAB"];
const RESERVATION_STATUSES: readonly ReservationStatus[] = [
  "PENDING",
  "CONFIRMED",
  "CANCELLED",
];

// In-memory stores. Seeded resource "res-101" is required for Lab 2 testing.
const resources: Resource[] = [
  {
    id: "res-101",
    name: "Group Study Room 101",
    type: "ROOM",
    location: "Snell Library, Floor 1",
    isAvailable: true,
  },
];

const reservations: Reservation[] = [];

/** Type guard for the ResourceType enum. */
export function isResourceType(value: string): value is ResourceType {
  return (RESOURCE_TYPES as readonly string[]).includes(value);
}

/** Type guard for the ReservationStatus enum. */
function isReservationStatus(value: string): value is ReservationStatus {
  return (RESERVATION_STATUSES as readonly string[]).includes(value);
}

/**
 * Return all resources, optionally filtered by type.
 * @param type - Optional resource-type filter.
 */
export function listResources(type?: ResourceType): Resource[] {
  if (type === undefined) {
    return [...resources];
  }
  return resources.filter((resource): boolean => resource.type === type);
}

/** Parse an ISO-8601 date-time string, throwing ValidationError if invalid. */
function parseInstant(value: string, field: string): number {
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    throw new ValidationError(`${field} must be a valid ISO-8601 date-time`);
  }
  return ms;
}

/** Two intervals overlap when each starts before the other ends. */
function overlaps(
  startA: number,
  endA: number,
  startB: number,
  endB: number,
): boolean {
  return startA < endB && endA > startB;
}

/**
 * Validate and store a new reservation.
 * @throws ValidationError when required fields are missing or malformed.
 * @throws ConflictError when the resource is already reserved for the range.
 */
export function createReservation(input: CreateReservationInput): Reservation {
  const { resourceId, userId, startTime, endTime, status } = input;

  if (typeof resourceId !== "string" || resourceId.trim() === "") {
    throw new ValidationError("resourceId is required");
  }
  if (typeof userId !== "string" || userId.trim() === "") {
    throw new ValidationError("userId is required");
  }

  const start = parseInstant(startTime, "startTime");
  const end = parseInstant(endTime, "endTime");
  if (start >= end) {
    throw new ValidationError("startTime must be before endTime");
  }

  const resource = resources.find((r): boolean => r.id === resourceId);
  if (resource === undefined) {
    throw new ValidationError(`Unknown resourceId: ${resourceId}`);
  }

  const conflict = reservations.some((existing): boolean => {
    if (existing.resourceId !== resourceId) {
      return false;
    }
    if (existing.status === "CANCELLED") {
      return false;
    }
    return overlaps(
      start,
      end,
      Date.parse(existing.startTime),
      Date.parse(existing.endTime),
    );
  });
  if (conflict) {
    throw new ConflictError(
      `Resource ${resourceId} is already reserved for the requested time`,
    );
  }

  const reservation: Reservation = {
    id: randomUUID(),
    resourceId,
    userId,
    startTime,
    endTime,
    status: status ?? "PENDING",
  };
  reservations.push(reservation);
  return { ...reservation };
}

/**
 * Return a user's active (non-cancelled) reservations.
 * @throws ValidationError when userId is missing.
 */
export function getUserReservations(userId: string): Reservation[] {
  if (typeof userId !== "string" || userId.trim() === "") {
    throw new ValidationError("userId is required");
  }
  return reservations.filter(
    (reservation): boolean =>
      reservation.userId === userId && reservation.status !== "CANCELLED",
  );
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
