/**
 * Express application factory.
 *
 * Builds the Express (v5) application, mounts the versioned API router, and
 * registers not-found and error-handling middleware. Importing this module
 * has no side effects: src/server.ts connects to MongoDB and listens. Business
 * logic and DB access live in the service/model layers, not here.
 */
import express from "express";
import type { Request, Response, Express } from "express";

import { errorHandler } from "./middleware/errorHandler.js";
import { apiRouter } from "./routes/index.js";

const API_PREFIX = "/api/v1" as const;

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
