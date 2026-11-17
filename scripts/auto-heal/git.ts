/** Minimal git helpers for the auto-heal scripts (fixed argv, no shell). */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Runs `git <args>` in the current directory and returns stdout. */
export async function git(args: readonly string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", [...args], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return stdout;
}

/** Splits NUL-separated git output, dropping the trailing empty entry. */
export function splitNul(output: string): string[] {
  return output.split("\0").filter((entry) => entry.length > 0);
}
