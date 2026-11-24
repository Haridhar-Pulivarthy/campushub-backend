/**
 * Shared E2E settings, used by playwright.config.ts, the API launcher
 * (start-api.ts), and the database fixtures (fixtures.ts).
 */
import os from "node:os";
import path from "node:path";

/** The in-memory MongoDB started by start-api.ts; never the dev database. */
export const E2E_DB_NAME = "campushub_e2e";
export const E2E_MONGO_HOST = "127.0.0.1";
export const E2E_MONGO_PORT = 27027;
export const E2E_MONGO_URI = `mongodb://${E2E_MONGO_HOST}:${E2E_MONGO_PORT}/${E2E_DB_NAME}`;
/** mongod data directory; the fixtures check the server reports this path. */
export const E2E_DB_PATH: string = path.join(
  os.tmpdir(),
  "campushub-e2e-mongo",
);

/** The student the client runs as (VITE_CAMPUSHUB_USER_ID). */
export const E2E_STUDENT_ID = "student-001";

/** Browser locale and time zone; dates.ts computes times in the same zone. */
export const E2E_LOCALE = "en-US";
export const E2E_TIME_ZONE = "America/Los_Angeles";
