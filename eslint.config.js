import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

// Backend only: client/ has its own eslint.config.js and is linted from there.
export default defineConfig([
  globalIgnores(["dist", "coverage", "client"]),
  {
    files: ["**/*.ts"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2023,
    },
    rules: {
      // CLAUDE.md §3: `any` and @ts-ignore are disallowed.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": "error",
    },
  },
]);
