/**
 * Application (domain) errors.
 *
 * Thrown by services for business-rule failures and by controllers for
 * malformed requests. Each carries the public ErrorResponse `code`, so the
 * same error class can report endpoint-specific codes. The centralized error
 * middleware (src/middleware/errorHandler.ts) maps the class to an HTTP
 * status; nothing here depends on Express.
 */

/** Public `code` values of 4xx ErrorResponse bodies. */
export type ErrorCode =
  | "INVALID_BODY"
  | "INVALID_TYPE"
  | "INVALID_IS_AVAILABLE"
  | "INVALID_RESERVATION"
  | "INVALID_RESERVATION_ID"
  | "INVALID_USER_ID"
  | "RESERVATION_NOT_FOUND"
  | "RESERVATION_CONFLICT";

/** Base class for expected failures that are reported to the client. */
export abstract class DomainError extends Error {
  public readonly code: ErrorCode;

  protected constructor(code: ErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

/** Input fails a request-shape or domain validation rule (400). */
export class ValidationError extends DomainError {
  public constructor(code: ErrorCode, message: string) {
    super(code, message);
    this.name = "ValidationError";
  }
}

/** A referenced entity does not exist (404). */
export class NotFoundError extends DomainError {
  public constructor(code: ErrorCode, message: string) {
    super(code, message);
    this.name = "NotFoundError";
  }
}

/** The request conflicts with existing state, e.g. an overlapping booking (409). */
export class ConflictError extends DomainError {
  public constructor(code: ErrorCode, message: string) {
    super(code, message);
    this.name = "ConflictError";
  }
}
