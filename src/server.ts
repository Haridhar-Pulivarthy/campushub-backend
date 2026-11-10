/**
 * Server entry point.
 *
 * Connects to MongoDB, then serves the Express application over HTTP. Kept
 * separate from src/app.ts so the application can be imported without side
 * effects.
 */
import { createApp } from "./app.js";
import { connectDatabase } from "./config/database.js";
import { getMongoUri } from "./config/env.js";

const DEFAULT_PORT = 3000 as const;

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
