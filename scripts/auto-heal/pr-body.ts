/**
 * Writes the repair PR title and body (pr-title.txt, pr-body.md in OUT_DIR)
 * from repair.json and the verification step outcomes, and appends the body
 * to the job summary. Run after verification; it never claims human review.
 *
 * Environment: OUT_DIR, PR_NUMBER, PR_URL, PR_HEAD_REF, HEAD_SHA, RUN_URL,
 * RUN_ATTEMPT, LINT_RESULT, TYPECHECK_RESULT, TEST_RESULT, VERIFY_LOG.
 */
import { appendFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { git } from "./git.ts";
import { readRepairRecord } from "./record.ts";
import { stripAnsi } from "./text.ts";

function env(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

/** Stops model-written text from @-mentioning users or closing the quote. */
function neutralize(text: string): string {
  return text.replace(/@(?=[A-Za-z0-9-])/g, "@​").trim();
}

function quote(text: string): string {
  return neutralize(text)
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
}

function badge(result: string): string {
  return result === "success" ? `✅ ${result}` : `❌ ${result}`;
}

async function jestSummary(logFile: string): Promise<string> {
  const log = await readFile(logFile, "utf8");
  const lines = stripAnsi(log)
    .split("\n")
    .filter((line) => /^(Test Suites|Tests):/.test(line.trim()))
    .map((line) => line.trim());
  return lines.length > 0 ? lines.join("; ") : "no Jest summary found";
}

async function main(): Promise<void> {
  const outDir = env("OUT_DIR");
  const record = await readRepairRecord(path.join(outDir, "repair.json"));
  const prNumber = env("PR_NUMBER");
  const headSha = env("HEAD_SHA");
  const lint = env("LINT_RESULT");
  const typecheck = env("TYPECHECK_RESULT");
  const test = env("TEST_RESULT");
  const diffStat = (
    await git(["diff", "--stat", "--no-color", "--", "src"])
  ).trimEnd();
  const summaryLine = neutralize(record.summary) || "Repair failing tests";
  const title = `Auto-heal #${prNumber}: ${summaryLine}`.slice(0, 120);

  const body = `## Auto-heal repair for #${prNumber}

This PR was opened by the Lab 8 auto-heal workflow. It targets the original PR's branch, not \`main\`.

| | |
| --- | --- |
| Original PR | #${prNumber} (${env("PR_URL")}), branch \`${env("PR_HEAD_REF")}\` |
| Failing commit | \`${headSha}\` |
| Workflow run | ${env("RUN_URL")} (attempt ${env("RUN_ATTEMPT")}) |
| Model | \`${record.model}\` (one repair attempt) |

### Diagnosis (AI-generated, unverified)

${quote(record.diagnosis || "(no diagnosis returned)")}

### Changes

Only application source under \`src/\` was allowed to change; tests, configuration, dependencies, and workflows were rejected by policy.

\`\`\`text
${diffStat}
\`\`\`

### Verification

Run in the auto-heal job on the failing commit plus this patch, before this PR was opened:

| Check | Command | Result |
| --- | --- | --- |
| Lint | \`npm run lint\` | ${badge(lint)} |
| Typecheck | \`npm run typecheck\` | ${badge(typecheck)} |
| Jest | \`npm test -- --ci\` | ${badge(test)} — ${await jestSummary(env("VERIFY_LOG"))} |

PRs opened with \`GITHUB_TOKEN\` do not trigger new workflow runs, so CI may not run on this PR by itself.

### Human review: ⏳ Pending

No human has reviewed this change yet. Before merging, a reviewer should confirm:

- [ ] The diagnosis matches the real root cause in the original PR's diff.
- [ ] The fix corrects the source; it does not change tests or weaken validation, status codes, or error messages.
- [ ] The change follows CLAUDE.md (layers, explicit types, no \`any\`, centralized errors).
`;

  await writeFile(path.join(outDir, "pr-title.txt"), `${title}\n`);
  await writeFile(path.join(outDir, "pr-body.md"), body);
  const summaryFile = process.env["GITHUB_STEP_SUMMARY"];
  if (summaryFile !== undefined && summaryFile.length > 0) {
    await appendFile(summaryFile, body);
  }
  console.log(title);
}

try {
  await main();
} catch (error: unknown) {
  console.error(
    `::error::${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
}
