/**
 * API types for the CampusHub backend.
 *
 * Mirrors the schemas in docs/openapi.yaml. The client cannot import backend
 * source, so these are kept in sync with the contract by hand. `date-time`
 * fields are ISO-8601 strings, matching the JSON wire format.
 */

/** Category of a campus resource (Resource.type enum). */
export type ResourceType = "ROOM" | "EQUIPMENT" | "LAB";

export const RESOURCE_TYPES: readonly ResourceType[] = [
  "ROOM",
  "EQUIPMENT",
  "LAB",
];

/** Reservation lifecycle status (Reservation.status enum). */
export type ReservationStatus = "PENDING" | "CONFIRMED" | "CANCELLED";

export const RESERVATION_STATUSES: readonly ReservationStatus[] = [
  "PENDING",
  "CONFIRMED",
  "CANCELLED",
];

/** A bookable campus resource (Resource schema). */
export interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  location: string;
  isAvailable: boolean;
}

/** A time-slotted reservation of a campus resource (Reservation schema). */
export interface Reservation {
  id: string;
  resourceId: string;
  userId: string;
  /** ISO-8601 date-time string. */
  startTime: string;
  /** ISO-8601 date-time string. */
  endTime: string;
  status: ReservationStatus;
}

/**
 * Body of POST /reservations (CreateReservationRequest schema). UI booking
 * requests omit `status` so the backend applies its default (PENDING).
 */
export interface CreateReservationDTO {
  resourceId: string;
  userId: string;
  /** ISO-8601 date-time string. */
  startTime: string;
  /** ISO-8601 date-time string. */
  endTime: string;
  status?: ReservationStatus;
}

/** Standard error envelope (ErrorResponse schema). */
export interface ErrorResponse {
  code: string;
  message: string;
}
