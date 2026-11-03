/**
 * Serialized CampusHub API types, shared by the backend (`src/`) and the
 * client (`client/src/`).
 *
 * Mirrors the schemas in docs/openapi.yaml: these are JSON wire shapes, so
 * ids are strings and `date-time` fields are ISO-8601 strings. Mongoose
 * persistence types (ObjectId, Date) stay in `src/models/`.
 *
 * Declarations only: import with `import type`. Runtime enum values and
 * response validation live with each consumer; these types do not validate
 * anything at runtime.
 */

/** Category of a campus resource (Resource.type enum). */
export type ResourceType = "ROOM" | "EQUIPMENT" | "LAB";

/** Reservation lifecycle status (Reservation.status enum). */
export type ReservationStatus = "PENDING" | "CONFIRMED" | "CANCELLED";

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
 * Body of POST /reservations (CreateReservationRequest schema). `status` is
 * optional; when omitted the backend applies its default (PENDING).
 */
export interface CreateReservationRequest {
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
