/**
 * Application entry point.
 *
 * Builds the Express (v5) application, mounts the versioned API router, and
 * registers not-found and error-handling middleware. Business logic and DB
 * access live in the service/model layers, not here.
 */
import express from "express";
import type { Request, Response, NextFunction, Express } from "express";

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

  // Centralized error handler. Express v5 forwards rejected async handlers
  // here automatically, but handlers in this codebase also forward via next().
  app.use(
    (err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
      const message =
        err instanceof Error ? err.message : "Internal Server Error";
      res.status(500).json({ error: message });
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

const app = createApp();
const port = resolvePort();

app.listen(port, (): void => {
  console.log(`CampusHub backend listening on port ${port}`);
});
