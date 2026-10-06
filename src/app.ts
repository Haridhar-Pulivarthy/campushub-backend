/**
 * Application entry point.
 *
 * Builds the Express (v5) application, mounts the versioned API router, and
 * registers not-found and error-handling middleware. Business logic and DB
 * access live in the service/model layers, not here.
 */
import express from "express";
import type { Request, Response, NextFunction, Express } from "express";

import { connectDatabase } from "./config/database.js";
import { getMongoUri } from "./config/env.js";
import { apiRouter } from "./routes/index.js";
import type { ErrorResponse } from "./types/reservation.js";

const API_PREFIX = "/api/v1" as const;
const DEFAULT_PORT = 3000 as const;

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

export function createApp(): Express {
  const app: Express = express();

  app.use(express.json());

  app.use(API_PREFIX, apiRouter);

  // 404 for unmatched routes.
  app.use((_req: Request, res: Response): void => {
    res.status(404).json({ error: "Not Found" });
  });

  // Centralized error handler — a backstop for errors raised outside
  // controllers (controllers format their own 4xx/500 responses).
  // Responds with the OpenAPI ErrorResponse shape; internal details are logged
  // server-side, never sent to the client. Unparseable request bodies are
  // invalid requests (400), not server errors.
  app.use(
    (err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
      if (isBodyParserClientError(err)) {
        const body: ErrorResponse = {
          code: "INVALID_BODY",
          message: "Request body must be valid JSON",
        };
        res.status(400).json(body);
        return;
      }
      console.error(err);
      const body: ErrorResponse = {
        code: "INTERNAL_ERROR",
        message: "Internal Server Error",
      };
      res.status(500).json(body);
    },
  );

  return app;
}

function resolvePort(): number {
  const raw = process.env["PORT"];
  if (raw === undefined) {
    return DEFAULT_PORT;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? DEFAULT_PORT : parsed;
}

/** Connect to MongoDB, then start serving HTTP requests. */
async function start(): Promise<void> {
  await connectDatabase(getMongoUri());

  const app = createApp();
  const port = resolvePort();

  app.listen(port, (): void => {
    console.log(`CampusHub backend listening on port ${port}`);
  });
}

start().catch((err: unknown): void => {
  console.error("Failed to start CampusHub backend:", err);
  process.exit(1);
});
