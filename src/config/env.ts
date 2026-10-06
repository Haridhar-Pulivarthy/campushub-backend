/**
 * Environment configuration.
 *
 * Reads required settings from environment variables. There are no hardcoded
 * fallbacks for connection strings: a missing value fails fast at startup.
 */

/** Error thrown when a required environment variable is absent or empty. */
export class MissingEnvError extends Error {
  public constructor(name: string) {
    super(
      `Missing required environment variable ${name}. ` +
        `Set it before starting the server (e.g. ${name}=mongodb://localhost:27017/campushub).`,
    );
    this.name = "MissingEnvError";
  }
}

/** Return the value of a required environment variable, or throw. */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    throw new MissingEnvError(name);
  }
  return value;
}

/** MongoDB connection URI, from MONGODB_URI. */
export function getMongoUri(): string {
  return requireEnv("MONGODB_URI");
}
