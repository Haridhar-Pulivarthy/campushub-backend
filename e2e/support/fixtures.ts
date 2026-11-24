/**
 * Playwright fixtures for direct access to the E2E database: setup, reset,
 * and persistence checks only. Bookings themselves go through the browser.
 *
 * The connection is built from e2e-env.ts constants (never MONGODB_URI) and
 * is verified to be the launcher's in-memory server before any read or
 * write. Uses the application's own Mongoose models.
 */
import { realpath } from "node:fs/promises";
import path from "node:path";

import { test as base } from "@playwright/test";
import mongoose, { Types } from "mongoose";

import type { ReservationStatus } from "../../shared/api.js";
import { ReservationModel } from "../../src/models/Reservation.model.js";
import type { IReservation } from "../../src/models/Reservation.model.js";
import { ResourceModel } from "../../src/models/Resource.model.js";
import {
  E2E_DB_NAME,
  E2E_DB_PATH,
  E2E_MONGO_HOST,
  E2E_MONGO_PORT,
  E2E_MONGO_URI,
} from "./e2e-env.ts";

export { expect } from "@playwright/test";

const SERVER_SELECTION_TIMEOUT_MS = 5_000;

type LeanReservation = IReservation & { _id: Types.ObjectId };

export interface SeededResource {
  id: string;
  name: string;
}

/** A stored reservation, with ids and dates as strings for comparison. */
export interface StoredReservation {
  id: string;
  resourceId: string;
  userId: string;
  startTime: string;
  endTime: string;
  status: ReservationStatus;
}

export interface ReservationFilter {
  resourceId?: string;
  userId?: string;
}

export interface E2eDatabase {
  /** Insert an available ROOM resource. */
  seedRoom: (name: string, location: string) => Promise<SeededResource>;
  /** Insert a PENDING reservation. */
  seedPendingReservation: (input: {
    resourceId: string;
    userId: string;
    start: Date;
    end: Date;
  }) => Promise<StoredReservation>;
  /** Stored reservations (any status), ordered by start time. */
  listReservations: (
    filter?: ReservationFilter,
  ) => Promise<StoredReservation[]>;
}

interface WorkerFixtures {
  /** The database over one guarded connection per worker. */
  workerDb: E2eDatabase;
}

interface TestFixtures {
  /** The E2E database, emptied before each test that uses it. */
  db: E2eDatabase;
}

/** Real, absolute path; case-insensitive on Windows. */
async function canonicalPath(p: string): Promise<string> {
  const resolved = await realpath(path.resolve(p));
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

/** Read parsed.storage.dbPath from a getCmdLineOpts reply. */
function readDbPath(reply: unknown): string | undefined {
  if (typeof reply !== "object" || reply === null || !("parsed" in reply)) {
    return undefined;
  }
  const { parsed } = reply;
  if (typeof parsed !== "object" || parsed === null || !("storage" in parsed)) {
    return undefined;
  }
  const { storage } = parsed;
  if (
    typeof storage !== "object" ||
    storage === null ||
    !("dbPath" in storage)
  ) {
    return undefined;
  }
  return typeof storage.dbPath === "string" ? storage.dbPath : undefined;
}

/**
 * Throw unless the open connection is the launcher's in-memory server:
 * loopback host and E2E port, database campushub_e2e, and a server data
 * directory equal to E2E_DB_PATH (which no dev or Docker mongod uses).
 */
async function assertIsE2eServer(): Promise<void> {
  const { connection } = mongoose;
  const { db } = connection;
  if (
    connection.host !== E2E_MONGO_HOST ||
    connection.port !== E2E_MONGO_PORT
  ) {
    throw new Error(
      `Connected to ${connection.host}:${connection.port}, not the E2E server.`,
    );
  }
  if (db === undefined || db.databaseName !== E2E_DB_NAME) {
    throw new Error(`Connected database is not ${E2E_DB_NAME}.`);
  }
  const serverDbPath = readDbPath(
    await db.admin().command({ getCmdLineOpts: 1 }),
  );
  if (
    serverDbPath === undefined ||
    (await canonicalPath(serverDbPath)) !== (await canonicalPath(E2E_DB_PATH))
  ) {
    throw new Error(
      `MongoDB data directory ${String(serverDbPath)} is not ${E2E_DB_PATH}; refusing to use it.`,
    );
  }
}

function toStored(doc: LeanReservation): StoredReservation {
  return {
    id: doc._id.toString(),
    resourceId: doc.resourceId.toString(),
    userId: doc.userId,
    startTime: doc.startTime.toISOString(),
    endTime: doc.endTime.toISOString(),
    status: doc.status,
  };
}

const database: E2eDatabase = {
  async seedRoom(name: string, location: string): Promise<SeededResource> {
    const resource = await ResourceModel.create({
      name,
      type: "ROOM",
      location,
      isAvailable: true,
    });
    return { id: resource._id.toString(), name };
  },

  async seedPendingReservation({
    resourceId,
    userId,
    start,
    end,
  }: {
    resourceId: string;
    userId: string;
    start: Date;
    end: Date;
  }): Promise<StoredReservation> {
    const created = await ReservationModel.create({
      resourceId: new Types.ObjectId(resourceId),
      userId,
      startTime: start,
      endTime: end,
      status: "PENDING",
    });
    return toStored(created.toObject<LeanReservation>());
  },

  async listReservations(
    filter: ReservationFilter = {},
  ): Promise<StoredReservation[]> {
    const query: { resourceId?: Types.ObjectId; userId?: string } = {};
    if (filter.resourceId !== undefined) {
      query.resourceId = new Types.ObjectId(filter.resourceId);
    }
    if (filter.userId !== undefined) {
      query.userId = filter.userId;
    }
    const docs = await ReservationModel.find(query)
      .sort({ startTime: 1 })
      .lean<LeanReservation[]>()
      .exec();
    return docs.map(toStored);
  },
};

export const test = base.extend<TestFixtures, WorkerFixtures>({
  workerDb: [
    // Playwright requires object destructuring for the fixtures argument.
    // eslint-disable-next-line no-empty-pattern
    async ({}, use: (value: E2eDatabase) => Promise<void>): Promise<void> => {
      await mongoose.connect(E2E_MONGO_URI, {
        serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS,
      });
      try {
        await assertIsE2eServer();
        await use(database);
      } finally {
        await mongoose.disconnect();
      }
    },
    { scope: "worker" },
  ],

  // Runs for every test execution (each project, repeat, and retry), so each
  // starts from only the data its own Given steps seed.
  db: async (
    { workerDb }: { workerDb: E2eDatabase },
    use: (value: E2eDatabase) => Promise<void>,
  ): Promise<void> => {
    await ReservationModel.deleteMany({}).exec();
    await ResourceModel.deleteMany({}).exec();
    await use(workerDb);
  },
});
