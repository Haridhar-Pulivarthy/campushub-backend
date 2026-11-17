/**
 * Edit policy for the auto-heal repair (Lab 8).
 *
 * The repair may change only existing application source under src/. Tests,
 * test setup, src/config/, type declarations, and every file outside src/
 * (configuration, dependencies, workflows, docs, scripts) are off limits.
 * Proposed content may not add lint or type-check suppressions.
 */
import path from "node:path";

export type PolicyResult = { ok: true } | { ok: false; reason: string };

const OK: PolicyResult = { ok: true };
const MAX_PATH_LENGTH = 200;
/** Larger than any current source file; blocks runaway output. */
export const MAX_FILE_BYTES = 100_000;

/** Directives that would hide a problem from ESLint or tsc. */
const SUPPRESSION_PATTERNS: readonly RegExp[] = [
  /eslint-disable/g,
  /@ts-ignore/g,
  /@ts-nocheck/g,
  /@ts-expect-error/g,
];

function reject(reason: string): PolicyResult {
  return { ok: false, reason };
}

/** Decides whether a repository-relative path may be edited by the repair. */
export function checkRepairPath(filePath: string): PolicyResult {
  if (filePath.length === 0 || filePath.length > MAX_PATH_LENGTH) {
    return reject("path is empty or too long");
  }
  if (filePath.includes("\\") || filePath.includes("\0")) {
    return reject("path must use forward slashes only");
  }
  if (path.posix.isAbsolute(filePath)) {
    return reject("path must be relative to the repository root");
  }
  const segments = filePath.split("/");
  if (
    path.posix.normalize(filePath) !== filePath ||
    segments.some((s) => s === "" || s === "." || s === "..")
  ) {
    return reject("path must be normalized (no '.', '..', or empty segments)");
  }
  if (segments[0] !== "src" || segments.length < 2) {
    return reject("only application source under src/ may change");
  }
  if (!filePath.endsWith(".ts") || filePath.endsWith(".d.ts")) {
    return reject("only .ts application source files may change");
  }
  if (
    segments[1] === "test" ||
    segments.includes("__tests__") ||
    /\.(test|spec)\.ts$/.test(filePath)
  ) {
    return reject("tests and test setup may not change");
  }
  if (segments[1] === "config") {
    return reject("src/config/ (runtime configuration) may not change");
  }
  return OK;
}

function countMatches(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0;
}

/** Decides whether replacing `original` with `updated` is an acceptable edit. */
export function checkRepairContent(
  original: string,
  updated: string,
): PolicyResult {
  if (updated.trim().length === 0) {
    return reject("new content is empty");
  }
  if (Buffer.byteLength(updated, "utf8") > MAX_FILE_BYTES) {
    return reject(`new content exceeds ${MAX_FILE_BYTES} bytes`);
  }
  if (updated.includes("\0")) {
    return reject("new content contains a NUL byte");
  }
  for (const pattern of SUPPRESSION_PATTERNS) {
    if (countMatches(updated, pattern) > countMatches(original, pattern)) {
      return reject(
        `new content adds a suppression directive (${pattern.source})`,
      );
    }
  }
  return OK;
}
