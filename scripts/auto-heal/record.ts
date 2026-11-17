/** The repair record written by repair.ts and read by pr-body.ts. */
import { readFile } from "node:fs/promises";

export type RepairStatus = "fixed" | "no_fix" | "refused" | "rejected";

export interface RepairRecord {
  status: RepairStatus;
  model: string;
  summary: string;
  diagnosis: string;
  files: string[];
  /** Policy violations when status is "rejected". */
  rejections: string[];
  inputTokens: number;
  outputTokens: number;
  dryRun: boolean;
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

export function isRepairRecord(value: unknown): value is RepairRecord {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const r = value as Record<string, unknown>;
  return (
    typeof r["status"] === "string" &&
    ["fixed", "no_fix", "refused", "rejected"].includes(r["status"]) &&
    typeof r["model"] === "string" &&
    typeof r["summary"] === "string" &&
    typeof r["diagnosis"] === "string" &&
    isStringArray(r["files"]) &&
    isStringArray(r["rejections"]) &&
    typeof r["inputTokens"] === "number" &&
    typeof r["outputTokens"] === "number" &&
    typeof r["dryRun"] === "boolean"
  );
}

export async function readRepairRecord(file: string): Promise<RepairRecord> {
  const parsed: unknown = JSON.parse(await readFile(file, "utf8"));
  if (!isRepairRecord(parsed)) {
    throw new Error(`${file} is not a valid repair record`);
  }
  return parsed;
}
