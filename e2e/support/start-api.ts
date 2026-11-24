/**
 * E2E backend launcher (Playwright webServer "API"; see playwright.config.ts).
 *
 * Starts an in-memory MongoDB on a fixed loopback port (so the test fixtures
 * can reach it), then runs the unmodified built backend (dist/server.js)
 * against it. MONGODB_URI is always replaced with the in-memory URI, so the
 * suite can never reach a development database. Data lives only for this
 * run. Run directly by Node 24 type stripping.
 */
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { MongoMemoryServer } from "mongodb-memory-server";

import {
  E2E_DB_NAME,
  E2E_DB_PATH,
  E2E_MONGO_HOST,
  E2E_MONGO_PORT,
} from "./e2e-env.ts";

/** client/vite.config.ts proxies /api to this port. */
const API_PORT = "3000";
const PORT_PROBE_TIMEOUT_MS = 1_000;

const REPO_ROOT: string = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const SERVER_ENTRY: string = path.join(REPO_ROOT, "dist", "server.js");

const SHUTDOWN_SIGNALS: readonly NodeJS.Signals[] = [
  "SIGINT",
  "SIGTERM",
  "SIGHUP",
];

/** Resolve true if something accepts TCP connections on host:port. */
function isAcceptingConnections(host: string, port: number): Promise<boolean> {
  return new Promise<boolean>((resolve): void => {
    const socket = net.connect({ host, port });
    socket.setTimeout(PORT_PROBE_TIMEOUT_MS);
    socket.once("connect", (): void => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", (): void => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", (): void => {
      resolve(false);
    });
  });
}

/** Resolve if host:port can be bound now; reject (e.g. EADDRINUSE) if not. */
function probeBind(host: string, port: number): Promise<void> {
  return new Promise<void>((resolve, reject): void => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(port, host, (): void => {
      server.close((): void => {
        resolve();
      });
    });
  });
}

/**
 * Fail before touching the data directory if the MongoDB port is in use.
 * mongodb-memory-server would otherwise silently pick another port. Both
 * checks are needed: on Windows a wildcard (0.0.0.0) listener does not
 * always block binding 127.0.0.1, but it does accept the connection.
 */
async function assertMongoPortFree(): Promise<void> {
  const target = `${E2E_MONGO_HOST}:${E2E_MONGO_PORT}`;
  if (await isAcceptingConnections(E2E_MONGO_HOST, E2E_MONGO_PORT)) {
    throw new Error(`${target} is already in use; stop that process first.`);
  }
  try {
    await probeBind(E2E_MONGO_HOST, E2E_MONGO_PORT);
  } catch (err: unknown) {
    throw new Error(`${target} cannot be bound; stop that process first.`, {
      cause: err,
    });
  }
}

/**
 * Delete and recreate the fixed mongod data directory. On Windows Playwright
 * force-kills this launcher, so the `finally` cleanup below does not run;
 * reusing one directory keeps at most one run's files (~160 MB) on disk.
 */
async function resetDbPath(): Promise<void> {
  await rm(E2E_DB_PATH, { recursive: true, force: true });
  await mkdir(E2E_DB_PATH, { recursive: true });
}

/** Start the backend with the in-memory URI, overriding any inherited one. */
function startBackend(mongoUri: string): ChildProcess {
  if (process.env["MONGODB_URI"] !== undefined) {
    console.log(
      "[e2e] Ignoring inherited MONGODB_URI; using in-memory MongoDB.",
    );
  }
  return spawn(process.execPath, [SERVER_ENTRY], {
    cwd: REPO_ROOT,
    env: { ...process.env, MONGODB_URI: mongoUri, PORT: API_PORT },
    stdio: "inherit",
  });
}

/** Resolve with the backend's exit code once it stops. */
function waitForExit(backend: ChildProcess): Promise<number> {
  return new Promise<number>((resolve): void => {
    backend.once("error", (err: Error): void => {
      console.error("[e2e] Could not start the backend:", err);
      resolve(1);
    });
    backend.once(
      "exit",
      (code: number | null, signal: NodeJS.Signals | null): void => {
        resolve(code ?? (signal === null ? 1 : 0));
      },
    );
  });
}

async function main(): Promise<number> {
  await assertMongoPortFree();
  await resetDbPath();
  const mongo: MongoMemoryServer = await MongoMemoryServer.create({
    instance: {
      dbName: E2E_DB_NAME,
      dbPath: E2E_DB_PATH,
      ip: E2E_MONGO_HOST,
      port: E2E_MONGO_PORT,
    },
  });
  try {
    // Never fall back to another port: the fixtures connect to this one.
    const actualPort = new URL(mongo.getUri()).port;
    if (actualPort !== String(E2E_MONGO_PORT)) {
      throw new Error(
        `In-memory MongoDB started on port ${actualPort}, not ${E2E_MONGO_PORT}.`,
      );
    }
    const mongoUri: string = mongo.getUri(E2E_DB_NAME);
    console.log(
      `[e2e] In-memory MongoDB ready on ${E2E_MONGO_HOST}:${E2E_MONGO_PORT} (database ${E2E_DB_NAME}).`,
    );

    const backend: ChildProcess = startBackend(mongoUri);
    const exited: Promise<number> = waitForExit(backend);

    // Forward shutdown signals; mongod is stopped once the backend exits.
    for (const signal of SHUTDOWN_SIGNALS) {
      process.once(signal, (): void => {
        backend.kill("SIGTERM");
      });
    }

    return await exited;
  } finally {
    await mongo.stop();
    await rm(E2E_DB_PATH, { recursive: true, force: true });
    console.log("[e2e] In-memory MongoDB stopped.");
  }
}

main().then(
  (code: number): void => {
    process.exit(code);
  },
  (err: unknown): void => {
    console.error("[e2e] Launcher failed:", err);
    process.exit(1);
  },
);
