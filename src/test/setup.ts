/**
 * Jest per-file setup (registered through setupFilesAfterEnv).
 *
 * Each test file gets its own in-memory MongoDB and an explicit Mongoose
 * connection to it. Collections are emptied after every test. Nothing here
 * reads MONGODB_URI or .env, so tests cannot reach a development database.
 */
import * as os from "node:os";

import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

/** Generous because the first run downloads the MongoDB binary. */
const STARTUP_TIMEOUT_MS = 300_000;

let mongoServer: MongoMemoryServer | undefined;

beforeAll(async (): Promise<void> => {
  // Makes any accidental getMongoUri() call fail instead of using a dev URI.
  delete process.env["MONGODB_URI"];

  mongoServer = await MongoMemoryServer.create();
  // NODE-7832: the driver sends empty client metadata under Jest's VM sandbox
  // unless the OS module is passed in explicitly.
  await mongoose.connect(mongoServer.getUri(), {
    runtimeAdapters: { os },
  });
}, STARTUP_TIMEOUT_MS);

afterEach(async (): Promise<void> => {
  // After a failed connect, deleteMany would buffer until the hook times out
  // and hide the real error.
  if (mongoose.connection.readyState !== mongoose.ConnectionStates.connected) {
    return;
  }

  await Promise.all(
    Object.values(mongoose.connection.collections).map(
      async (collection): Promise<void> => {
        await collection.deleteMany({});
      },
    ),
  );
});

afterAll(async (): Promise<void> => {
  try {
    await mongoose.disconnect();
  } finally {
    await mongoServer?.stop();
  }
});
