/**
 * Verifies the working tree contains only allowed repair edits: modified,
 * tracked application source under src/ (see policy.ts). Anything else -
 * new, deleted, or renamed files, or edits outside the policy - fails.
 *
 * Usage: node scripts/auto-heal/check-changes.ts [--require-changes]
 */
import { git, splitNul } from "./git.ts";
import { checkRepairPath } from "./policy.ts";

const MODIFIED_STATES: ReadonlySet<string> = new Set([" M", "M ", "MM"]);

async function main(): Promise<void> {
  const requireChanges = process.argv.includes("--require-changes");
  const entries = splitNul(
    await git(["status", "--porcelain=v1", "-z", "--untracked-files=all"]),
  );

  const changed: string[] = [];
  const problems: string[] = [];
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i] ?? "";
    const state = entry.slice(0, 2);
    const file = entry.slice(3);
    if (state.includes("R") || state.includes("C")) {
      i += 1; // the next entry is the rename/copy source
      problems.push(`${file}: renamed or copied (${state})`);
      continue;
    }
    if (!MODIFIED_STATES.has(state)) {
      problems.push(
        `${file}: only modifications are allowed (${state.trim()})`,
      );
      continue;
    }
    const check = checkRepairPath(file);
    if (!check.ok) {
      problems.push(`${file}: ${check.reason}`);
      continue;
    }
    changed.push(file);
  }

  for (const file of changed) {
    console.log(`allowed: ${file}`);
  }
  for (const problem of problems) {
    console.log(`::error title=Disallowed change::${problem}`);
  }
  if (problems.length > 0) {
    process.exitCode = 1;
  } else if (requireChanges && changed.length === 0) {
    console.log("::error::No allowed source changes to publish");
    process.exitCode = 1;
  }
}

try {
  await main();
} catch (error: unknown) {
  console.error(
    `::error::${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
}
