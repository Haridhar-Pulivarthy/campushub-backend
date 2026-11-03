/**
 * Centralized error-handling middleware.
 *
 * Express 5 forwards anything a route handler throws, including rejected
 * promises from async controllers, to this middleware. It is the only place
 * that turns errors into HTTP responses:
 *   - malformed or unreadable JSON bodies   -> 400 INVALID_BODY
 *   - DomainError (services/errors.ts)      -> 400/404/409 with its code
 *   - anything else                         -> logged, generic 500
 * Responses use the OpenAPI ErrorResponse shape and never expose internals.
 */
import type { NextFunction, Request, Response } from "express";

import type { ErrorResponse } from "../../shared/api.js";
import {
  ConflictError,
  DomainError,
  NotFoundError,
  ValidationError,
} from "../services/errors.js";

/**
 * True for client errors raised by express.json() (e.g. malformed JSON),
 * which carry a 4xx `status` and a string `type` such as
 * "entity.parse.failed".
 */
function isBodyParserClientError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) {
    return false;
  }
  const { status, type } = err as { status?: unknown; type?: unknown };
  return (
    typeof type === "string" &&
    typeof status === "number" &&
    status >= 400 &&
    status < 500
  );
}

/** HTTP status for a domain error, or undefined for an unmapped subclass. */
function statusFor(err: DomainError): number | undefined {
  if (err instanceof ValidationError) {
    return 400;
  }
  if (err instanceof NotFoundError) {
    return 404;
  }
  if (err instanceof ConflictError) {
    return 409;
  }
  return undefined;
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  // A response is already partly sent; let Express close the connection.
  if (res.headersSent) {
    next(err);
    return;
  }

  // Unparseable request bodies are invalid requests (400), not server errors.
  if (isBodyParserClientError(err)) {
    const body: ErrorResponse = {
      code: "INVALID_BODY",
      message: "Request body must be valid JSON",
    };
    res.status(400).json(body);
    return;
  }

  if (err instanceof DomainError) {
    const status = statusFor(err);
    if (status !== undefined) {
      const body: ErrorResponse = { code: err.code, message: err.message };
      res.status(status).json(body);
      return;
    }
  }

  // Unexpected: log details server-side, send only a generic body.
  console.error(err);
  const body: ErrorResponse = {
    code: "INTERNAL_ERROR",
    message: "Internal Server Error",
  };
  res.status(500).json(body);
}
