/**
 * Lab 8 auto-heal: one AI repair attempt for a failing Jest run.
 *
 * Gives Claude the Jest failure log, the PR diff, and the repository's
 * application source and tests, asks for a source-only fix as structured
 * JSON, validates every proposed edit against policy.ts, and writes the
 * accepted files. It makes at most one API request and never runs anything
 * the model suggests. Lint, typecheck, and Jest run in later workflow steps,
 * which do not receive the API key.
 *
 * Environment:
 *   ANTHROPIC_API_KEY  Actions secret; read by the SDK, never logged.
 *   ANTHROPIC_MODEL    Model ID (default claude-opus-5-5).
 *   AUTO_HEAL_EFFORT   low | medium | high | xhigh | max (default high).
 *   TEST_LOG           Path to the failing Jest output (test-results.log).
 *   BASE_SHA, HEAD_SHA PR base and head commits, for the PR diff.
 *   OUT_DIR            Where repair.json and prompt.md are written.
 *   AUTO_HEAL_DRY_RUN_RESPONSE  Local simulation only: path to a canned JSON
 *                      answer. No API request is made and no key is needed.
 */
import {
  lstat,
  mkdir,
  readFile,
  writeFile,
  appendFile,
} from "node:fs/promises";
import path from "node:path";

import Anthropic from "@anthropic-ai/sdk";

import { git, splitNul } from "./git.ts";
import { checkRepairContent, checkRepairPath } from "./policy.ts";
import type { RepairRecord } from "./record.ts";
import { stripAnsi } from "./text.ts";

const DEFAULT_MODEL = "claude-opus-5-5";
const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
type Effort = (typeof EFFORTS)[number];

const MAX_EDITED_FILES = 3;
const MAX_LOG_CHARS = 150_000;
const MAX_DIFF_CHARS = 150_000;
const MAX_CONTEXT_CHARS = 600_000;
/** Read-only context sent with every request, besides src/. */
const CONTEXT_PATHS = [
  "CLAUDE.md",
  "docs/openapi.yaml",
  "shared/api.d.ts",
  "src",
];

interface RepairEdit {
  path: string;
  content: string;
}

interface RepairAnswer {
  status: "fix" | "no_fix";
  summary: string;
  diagnosis: string;
  edits: RepairEdit[];
}

interface ModelResult {
  answer: RepairAnswer | undefined;
  inputTokens: number;
  outputTokens: number;
}

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["status", "summary", "diagnosis", "edits"],
  properties: {
    status: {
      type: "string",
      enum: ["fix", "no_fix"],
      description: '"fix" when edits repair the failure, otherwise "no_fix".',
    },
    summary: {
      type: "string",
      description: "Imperative PR title for the fix, under 70 characters.",
    },
    diagnosis: {
      type: "string",
      description:
        "2-5 sentences: which change caused which failing tests, and how the edits fix it (or why no safe fix exists).",
    },
    edits: {
      type: "array",
      description: "Files to replace; empty when status is no_fix.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["path", "content"],
        properties: {
          path: {
            type: "string",
            description: 'Repository-relative path, e.g. "src/services/x.ts".',
          },
          content: {
            type: "string",
            description: "The complete new file content.",
          },
        },
      },
    },
  },
} as const;

const SYSTEM_PROMPT = `You repair failing backend tests for CampusHub, a TypeScript Express 5 + Mongoose 9 API. A pull request introduced a change that makes the Jest suite fail. Find the root cause in the application source and fix it.

How to repair:
- The tests and docs/openapi.yaml are the specification. Never change, delete, or skip tests, and never loosen validation, status codes, error codes, or messages to make a test pass.
- Edit only files marked editable="true". An edit to any other file is rejected and the whole repair is discarded.
- Make the smallest change that fixes the root cause, usually by correcting the faulty part of the PR diff. Follow the conventions in CLAUDE.md: explicit types, no \`any\`, no @ts-ignore or eslint-disable comments, errors as domain errors.
- Return the complete new content of each edited file, at most ${MAX_EDITED_FILES} files.
- If the failure is not caused by application source (for example a broken test, configuration, or the environment), or you cannot identify the cause with confidence, return status "no_fix" with no edits and explain why in the diagnosis.

A script applies your answer, then ESLint, tsc, and the full Jest suite run before a human reviews the result. Commands you suggest are not run.`;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

function readEffort(): Effort {
  const value = process.env["AUTO_HEAL_EFFORT"] || "high";
  const effort = EFFORTS.find((e) => e === value);
  if (effort === undefined) {
    throw new Error(`AUTO_HEAL_EFFORT must be one of ${EFFORTS.join(", ")}`);
  }
  return effort;
}

/** Keeps the end of a log (where Jest prints failures) and says so. */
function keepTail(text: string, max: number, label: string): string {
  if (text.length <= max) {
    return text;
  }
  return `[${label}: first ${text.length - max} characters omitted]\n${text.slice(-max)}`;
}

/** Keeps the start of a diff and says so. */
function keepHead(text: string, max: number, label: string): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max)}\n[${label}: last ${text.length - max} characters omitted]`;
}

async function buildPrompt(
  testLog: string,
  baseSha: string,
  headSha: string,
): Promise<string> {
  const log = keepTail(
    stripAnsi(await readFile(testLog, "utf8")),
    MAX_LOG_CHARS,
    "log truncated",
  );
  const diff = keepHead(
    await git(["diff", "--no-color", `${baseSha}...${headSha}`]),
    MAX_DIFF_CHARS,
    "diff truncated",
  );

  const files = splitNul(await git(["ls-files", "-z", "--", ...CONTEXT_PATHS]));
  const fileBlocks: string[] = [];
  for (const file of files) {
    const editable = checkRepairPath(file).ok;
    const content = await readFile(file, "utf8");
    fileBlocks.push(
      `<file path="${file}" editable="${editable}">\n${content}\n</file>`,
    );
  }

  const prompt = [
    "<failing_test_log>",
    log,
    "</failing_test_log>",
    "",
    `<pr_diff base="${baseSha}" head="${headSha}">`,
    diff,
    "</pr_diff>",
    "",
    "<repository_files>",
    ...fileBlocks,
    "</repository_files>",
    "",
    "Diagnose why the Jest suite fails on this pull request and return the repair as JSON matching the response schema.",
  ].join("\n");

  if (prompt.length > MAX_CONTEXT_CHARS) {
    // Refuse rather than silently dropping source the model may need.
    throw new Error(
      `Prompt is ${prompt.length} characters (limit ${MAX_CONTEXT_CHARS}); not sending a partial repository`,
    );
  }
  return prompt;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Validates the model's JSON answer; structured outputs should guarantee it. */
function parseAnswer(text: string): RepairAnswer {
  const value: unknown = JSON.parse(text);
  if (
    !isRecord(value) ||
    (value["status"] !== "fix" && value["status"] !== "no_fix") ||
    typeof value["summary"] !== "string" ||
    typeof value["diagnosis"] !== "string" ||
    !Array.isArray(value["edits"])
  ) {
    throw new Error("Model answer does not match the response schema");
  }
  const edits: RepairEdit[] = [];
  for (const edit of value["edits"] as unknown[]) {
    if (
      !isRecord(edit) ||
      typeof edit["path"] !== "string" ||
      typeof edit["content"] !== "string"
    ) {
      throw new Error("Model answer has a malformed edit");
    }
    edits.push({ path: edit["path"], content: edit["content"] });
  }
  return {
    status: value["status"],
    summary: value["summary"],
    diagnosis: value["diagnosis"],
    edits,
  };
}

async function askModel(
  model: string,
  effort: Effort,
  prompt: string,
): Promise<ModelResult> {
  // Reads ANTHROPIC_API_KEY from the environment; the key is never printed.
  const client = new Anthropic({ maxRetries: 3 });
  const stream = client.messages.stream({
    model,
    max_tokens: 64_000,
    output_config: {
      effort,
      format: { type: "json_schema", schema: RESPONSE_SCHEMA },
    },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });
  const message = await stream.finalMessage();
  const usage = {
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
  };

  if (message.stop_reason === "refusal") {
    console.warn(
      `Model declined the request (category: ${message.stop_details?.category ?? "unknown"})`,
    );
    return { answer: undefined, ...usage };
  }
  if (message.stop_reason === "max_tokens") {
    throw new Error("Model answer was cut off at max_tokens; not applying it");
  }
  const text = message.content
    .flatMap((block) => (block.type === "text" ? [block.text] : []))
    .join("");
  return { answer: parseAnswer(text), ...usage };
}

/** Returns policy violations; an empty list means every edit may be applied. */
async function validateEdits(edits: readonly RepairEdit[]): Promise<string[]> {
  const problems: string[] = [];
  if (edits.length > MAX_EDITED_FILES) {
    problems.push(`${edits.length} files edited (limit ${MAX_EDITED_FILES})`);
  }
  const tracked = new Set(splitNul(await git(["ls-files", "-z", "--", "src"])));
  const seen = new Set<string>();

  for (const edit of edits) {
    const where = JSON.stringify(edit.path);
    const pathCheck = checkRepairPath(edit.path);
    if (!pathCheck.ok) {
      problems.push(`${where}: ${pathCheck.reason}`);
      continue;
    }
    if (seen.has(edit.path)) {
      problems.push(`${where}: edited more than once`);
      continue;
    }
    seen.add(edit.path);
    if (!tracked.has(edit.path)) {
      problems.push(`${where}: not an existing tracked file`);
      continue;
    }
    const stats = await lstat(edit.path);
    if (!stats.isFile() || stats.isSymbolicLink()) {
      problems.push(`${where}: not a regular file`);
      continue;
    }
    const original = await readFile(edit.path, "utf8");
    const contentCheck = checkRepairContent(original, edit.content);
    if (!contentCheck.ok) {
      problems.push(`${where}: ${contentCheck.reason}`);
    } else if (original === edit.content) {
      problems.push(`${where}: content is unchanged`);
    }
  }
  return problems;
}

async function setOutputs(outputs: Record<string, string>): Promise<void> {
  const file = process.env["GITHUB_OUTPUT"];
  if (file === undefined || file.length === 0) {
    return;
  }
  const lines = Object.entries(outputs).map(([k, v]) => `${k}=${v}\n`);
  await appendFile(file, lines.join(""));
}

async function main(): Promise<void> {
  const model = process.env["ANTHROPIC_MODEL"] || DEFAULT_MODEL;
  const effort = readEffort();
  const testLog = requireEnv("TEST_LOG");
  const baseSha = requireEnv("BASE_SHA");
  const headSha = requireEnv("HEAD_SHA");
  const outDir = requireEnv("OUT_DIR");
  const dryRunFile = process.env["AUTO_HEAL_DRY_RUN_RESPONSE"] ?? "";
  const dryRun = dryRunFile.length > 0;

  if (!dryRun && !process.env["ANTHROPIC_API_KEY"]) {
    throw new Error(
      "The ANTHROPIC_API_KEY Actions secret is not configured; see docs/lab8-auto-heal.md",
    );
  }

  await mkdir(outDir, { recursive: true });
  const prompt = await buildPrompt(testLog, baseSha, headSha);
  await writeFile(path.join(outDir, "prompt.md"), prompt);
  console.log(
    `Prompt: ${prompt.length} characters; model ${model}, effort ${effort}`,
  );

  const result: ModelResult = dryRun
    ? {
        answer: parseAnswer(await readFile(dryRunFile, "utf8")),
        inputTokens: 0,
        outputTokens: 0,
      }
    : await askModel(model, effort, prompt);

  const record: RepairRecord = {
    status: "no_fix",
    model,
    summary: result.answer?.summary ?? "",
    diagnosis: result.answer?.diagnosis ?? "",
    files: [],
    rejections: [],
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    dryRun,
  };

  const answer = result.answer;
  if (answer === undefined) {
    record.status = "refused";
  } else if (answer.status === "fix" && answer.edits.length > 0) {
    const problems = await validateEdits(answer.edits);
    if (problems.length > 0) {
      record.status = "rejected";
      record.rejections = problems;
    } else {
      for (const edit of answer.edits) {
        await writeFile(edit.path, edit.content);
      }
      record.status = "fixed";
      record.files = answer.edits.map((edit) => edit.path);
    }
  }

  await writeFile(
    path.join(outDir, "repair.json"),
    `${JSON.stringify(record, null, 2)}\n`,
  );
  await setOutputs({
    applied: String(record.status === "fixed"),
    status: record.status,
  });

  console.log(
    `Repair status: ${record.status} (model ${model}${dryRun ? ", dry run" : ""})`,
  );
  console.log(`Diagnosis: ${record.diagnosis || "(none)"}`);
  if (record.status === "fixed") {
    console.log(`Edited: ${record.files.join(", ")}`);
  } else if (record.status === "rejected") {
    for (const problem of record.rejections) {
      console.log(`::error title=Auto-heal edit rejected::${problem}`);
    }
    process.exitCode = 1;
  } else {
    console.log("::warning title=Auto-heal::No repair was applied");
  }
}

try {
  await main();
} catch (error: unknown) {
  if (error instanceof Anthropic.AuthenticationError) {
    console.error(
      "::error::Anthropic API authentication failed; check the ANTHROPIC_API_KEY secret",
    );
  } else if (error instanceof Anthropic.APIError) {
    console.error(
      `::error::Anthropic API error ${String(error.status)}: ${error.message}`,
    );
  } else {
    console.error(
      `::error::${error instanceof Error ? error.message : String(error)}`,
    );
  }
  process.exitCode = 1;
}
