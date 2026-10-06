/**
 * Database connection helper.
 *
 * The only place the application opens its Mongoose connection. Called once
 * from application startup, before the HTTP server begins listening.
 */
import mongoose from "mongoose";

/**
 * Connect Mongoose to MongoDB.
 * @param uri - MongoDB connection URI (see config/env.ts).
 * @throws When the initial connection cannot be established.
 */
export async function connectDatabase(uri: string): Promise<void> {
  // Log errors raised after the initial connection (e.g. a dropped link) so
  // they are not emitted on the connection without a listener.
  mongoose.connection.on("error", (err: unknown): void => {
    console.error("MongoDB connection error:", err);
  });

  await mongoose.connect(uri);
  console.log("Connected to MongoDB");
}
