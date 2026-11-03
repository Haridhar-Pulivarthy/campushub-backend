/**
 * Application entry point.
 *
 * Builds the Express (v5) application, mounts the versioned API router, and
 * registers not-found and error-handling middleware. Business logic and DB
 * access live in the service/model layers, not here.
 */
import express from "express";
import type { Request, Response, Express } from "express";

import { connectDatabase } from "./config/database.js";
import { getMongoUri } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { apiRouter } from "./routes/index.js";

const API_PREFIX = "/api/v1" as const;
const DEFAULT_PORT = 3000 as const;

export function createApp(): Express {
  const app: Express = express();

  app.use(express.json());

  app.use(API_PREFIX, apiRouter);

  // 404 for unmatched routes.
  app.use((_req: Request, res: Response): void => {
    res.status(404).json({ error: "Not Found" });
  });

  // Centralized error handling: formats every error response (registered
  // last so it sees errors from routes, controllers, and body parsing).
  app.use(errorHandler);

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
