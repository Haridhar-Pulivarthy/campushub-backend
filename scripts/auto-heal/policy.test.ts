/** Unit tests for the auto-heal edit policy (run: npm run test:scripts). */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { checkRepairContent, checkRepairPath } from "./policy.ts";

describe("checkRepairPath", (): void => {
  it("accepts application source under src/", (): void => {
    for (const p of [
      "src/services/reservation.service.ts",
      "src/controllers/reservation.controller.ts",
      "src/middleware/errorHandler.ts",
      "src/models/Reservation.model.ts",
      "src/app.ts",
    ]) {
      assert.deepEqual(checkRepairPath(p), { ok: true }, p);
    }
  });

  it("rejects tests, test setup, and runtime config", (): void => {
    for (const p of [
      "src/services/__tests__/reservation.service.test.ts",
      "src/routes/__tests__/health.routes.test.ts",
      "src/test/setup.ts",
      "src/foo.spec.ts",
      "src/foo.test.ts",
      "src/config/env.ts",
    ]) {
      assert.equal(checkRepairPath(p).ok, false, p);
    }
  });

  it("rejects files outside src/ and non-source files", (): void => {
    for (const p of [
      "package.json",
      "package-lock.json",
      "jest.config.ts",
      "eslint.config.js",
      ".github/workflows/ci.yml",
      "scripts/auto-heal/policy.ts",
      "shared/api.d.ts",
      "client/src/App.tsx",
      "src/types.d.ts",
      "src/data.json",
      "src",
    ]) {
      assert.equal(checkRepairPath(p).ok, false, p);
    }
  });

  it("rejects traversal, absolute, and non-normalized paths", (): void => {
    for (const p of [
      "",
      "src/../package.json",
      "./src/app.ts",
      "src//app.ts",
      "/src/app.ts",
      "src\\app.ts",
      "C:/repo/src/app.ts",
      "src/./app.ts",
      `src/${"a".repeat(300)}.ts`,
    ]) {
      assert.equal(checkRepairPath(p).ok, false, JSON.stringify(p));
    }
  });
});

describe("checkRepairContent", (): void => {
  const original = "export const x = 1;\n";

  it("accepts an ordinary edit", (): void => {
    assert.deepEqual(checkRepairContent(original, "export const x = 2;\n"), {
      ok: true,
    });
  });

  it("rejects empty content and NUL bytes", (): void => {
    assert.equal(checkRepairContent(original, "  \n").ok, false);
    assert.equal(checkRepairContent(original, "a\0b").ok, false);
  });

  it("rejects newly added suppression directives", (): void => {
    for (const directive of [
      "// eslint-disable-next-line",
      "/* eslint-disable */",
      "// @ts-ignore",
      "// @ts-nocheck",
      "// @ts-expect-error",
    ]) {
      const updated = `${directive}\nexport const x = 2;\n`;
      assert.equal(checkRepairContent(original, updated).ok, false, directive);
    }
  });

  it("allows suppressions that were already present", (): void => {
    const withDirective = "// @ts-expect-error legacy\nexport const x = 1;\n";
    assert.deepEqual(
      checkRepairContent(withDirective, withDirective.replace("1", "2")),
      { ok: true },
    );
  });

  it("rejects oversized content", (): void => {
    assert.equal(checkRepairContent(original, "x".repeat(100_001)).ok, false);
  });
});
