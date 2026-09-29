/**
 * Reservation domain types.
 *
 * Mirrors the OpenAPI contract (docs/openapi.yaml) exactly — no properties are
 * added beyond those defined in the `Reservation` and `ErrorResponse` schemas.
 * `date-time` fields are represented as ISO-8601 strings, matching the JSON
 * wire format.
 */

/** Category of a campus resource (Resource.type enum). */
export type ResourceType = "ROOM" | "EQUIPMENT" | "LAB";

/** A bookable campus resource. */
export interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  location: string;
  isAvailable: boolean;
}

/** Reservation lifecycle status (Reservation.status enum). */
export type ReservationStatus = "PENDING" | "CONFIRMED" | "CANCELLED";

/** A time-slotted reservation of a campus resource. */
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

/** Standard error envelope returned by reservation endpoints. */
export interface ErrorResponse {
  code: string;
  message: string;
}
