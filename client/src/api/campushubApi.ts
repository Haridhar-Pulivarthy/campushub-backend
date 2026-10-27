/**
 * CampusHub API client.
 *
 * Typed `fetch` wrappers for the four endpoints the UI uses (see
 * docs/openapi.yaml). Requests go to the relative `/api/v1` path, which the
 * Vite dev server proxies to the backend. Every response body is read as
 * `unknown` and checked against the contract before it is returned; any
 * failure is thrown as an `ApiError` so callers can branch on `status`
 * (e.g. 409 for a booking conflict).
 */
import {
  RESERVATION_STATUSES,
  RESOURCE_TYPES,
  type CreateReservationDTO,
  type ErrorResponse,
  type Reservation,
  type ReservationStatus,
  type Resource,
  type ResourceType,
} from "../types/api.ts";

const API_BASE_URL = "/api/v1";

/** `status` used for failures where no HTTP response was received. */
const NO_RESPONSE_STATUS = 0;

/** Error thrown by every API method; carries the HTTP status and error code. */
export class ApiError extends Error {
  /** HTTP status code, or 0 when the server could not be reached. */
  public readonly status: number;
  /** ErrorResponse `code` from the backend, or a client-side code. */
  public readonly code: string;

  public constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

/** True when a booking failed because the time slot is already reserved. */
export function isConflictError(err: unknown): err is ApiError {
  return err instanceof ApiError && err.status === 409;
}

type Guard<T> = (value: unknown) => value is T;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isResourceType(value: unknown): value is ResourceType {
  return (
    typeof value === "string" &&
    (RESOURCE_TYPES as readonly string[]).includes(value)
  );
}

function isReservationStatus(value: unknown): value is ReservationStatus {
  return (
    typeof value === "string" &&
    (RESERVATION_STATUSES as readonly string[]).includes(value)
  );
}

function isResource(value: unknown): value is Resource {
  return (
    isRecord(value) &&
    typeof value["id"] === "string" &&
    typeof value["name"] === "string" &&
    isResourceType(value["type"]) &&
    typeof value["location"] === "string" &&
    typeof value["isAvailable"] === "boolean"
  );
}

function isReservation(value: unknown): value is Reservation {
  return (
    isRecord(value) &&
    typeof value["id"] === "string" &&
    typeof value["resourceId"] === "string" &&
    typeof value["userId"] === "string" &&
    typeof value["startTime"] === "string" &&
    typeof value["endTime"] === "string" &&
    isReservationStatus(value["status"])
  );
}

function isErrorResponse(value: unknown): value is ErrorResponse {
  return (
    isRecord(value) &&
    typeof value["code"] === "string" &&
    typeof value["message"] === "string"
  );
}

function isResourceArray(value: unknown): value is Resource[] {
  return Array.isArray(value) && value.every(isResource);
}

function isReservationArray(value: unknown): value is Reservation[] {
  return Array.isArray(value) && value.every(isReservation);
}

/** Parse a response body as JSON; undefined when it is empty or not JSON. */
async function readJson(response: Response): Promise<unknown> {
  try {
    const body: unknown = await response.json();
    return body;
  } catch {
    return undefined;
  }
}

/**
 * Send a request and return its validated JSON body.
 * @throws ApiError on network failure, a non-2xx status, or a body that does
 *   not match the expected shape.
 */
async function request<T>(
  path: string,
  init: RequestInit,
  guard: Guard<T>,
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(
      NO_RESPONSE_STATUS,
      "NETWORK_ERROR",
      "Unable to reach the CampusHub server. Check your connection and try again.",
    );
  }

  const body = await readJson(response);

  if (!response.ok) {
    // Most errors use the ErrorResponse envelope; some (e.g. the backend's
    // unmatched-route 404 or a proxy failure) do not.
    if (isErrorResponse(body)) {
      throw new ApiError(response.status, body.code, body.message);
    }
    throw new ApiError(
      response.status,
      "HTTP_ERROR",
      `Request failed with status ${response.status}.`,
    );
  }

  if (!guard(body)) {
    throw new ApiError(
      response.status,
      "INVALID_RESPONSE",
      "The CampusHub server returned an unexpected response.",
    );
  }
  return body;
}

/** GET /resources — all resources, or only those of the given type. */
export async function fetchResources(type?: ResourceType): Promise<Resource[]> {
  const query =
    type === undefined ? "" : `?${new URLSearchParams({ type }).toString()}`;
  return request(`/resources${query}`, { method: "GET" }, isResourceArray);
}

/**
 * POST /reservations — create a reservation.
 * A 409 ApiError (see isConflictError) means the slot is already booked.
 */
export async function createReservation(
  payload: CreateReservationDTO,
): Promise<Reservation> {
  return request(
    "/reservations",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    isReservation,
  );
}

/** GET /reservations/user/{userId} — the user's non-cancelled reservations. */
export async function fetchUserReservations(
  userId: string,
): Promise<Reservation[]> {
  return request(
    `/reservations/user/${encodeURIComponent(userId)}`,
    { method: "GET" },
    isReservationArray,
  );
}

/**
 * PATCH /reservations/{id}/cancel — cancel a reservation. Idempotent: an
 * already-cancelled reservation is returned in its current state.
 */
export async function cancelReservation(
  reservationId: string,
): Promise<Reservation> {
  return request(
    `/reservations/${encodeURIComponent(reservationId)}/cancel`,
    { method: "PATCH" },
    isReservation,
  );
}
