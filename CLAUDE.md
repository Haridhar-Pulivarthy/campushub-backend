# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

CampusHub is a backend for the CS 5500 course project. The constraints below are **course requirements**, not style suggestions. Treat them as hard rules: do not weaken, reinterpret, or trade any of them away for convenience, and refuse requests that would violate them (explain the conflict and offer a compliant alternative).

## Project state

This is a **bare scaffold**, not yet an application. As of this writing there is no source code, entry point, README, lint config, or tests — only `package.json` and `tsconfig.json`. When adding the first real code, you are establishing the conventions, so follow this file exactly.

---

## 1. Tech stack & libraries (authorized packages only)

- **Language:** TypeScript **only**. Do **not** create `.js` (or `.jsx`) source files anywhere under the application source. Raw JavaScript is forbidden. (Config files that must be JS, e.g. `eslint.config.js`, are the sole exception and live at the repo root, never in source.)
- **Authorized runtime dependencies:** `express` (v5), `mongoose` (v9). Nothing else.
- **Authorized dev dependencies:** `typescript`, `ts-node`, `eslint`, `prettier`, `@types/*` for the above.
- **Adding any other library is forbidden** unless the user explicitly authorizes it in this session. Do not `npm install` a new package to solve a problem — solve it with the authorized set, or stop and ask. If you believe a new dependency is genuinely necessary, propose it and wait for approval before installing.
- Note: Express is **v5** and Mongoose is **v9** — APIs differ from the v4/older examples common online. Verify against the installed major version.

## 2. Architectural boundaries (strict 3-tier separation)

Every feature flows **Route → Controller → Service → Model**. Each layer has one job and may not do another layer's work. Suggested layout: `src/routes/`, `src/controllers/`, `src/services/`, `src/models/`.

- **Routes** — route definitions and middleware mappings **only**. A route wires an HTTP method + path to middleware and a controller handler. No request parsing, no business logic, no DB access.
- **Controllers** — HTTP request/response handling and status codes **only**. Read inputs from the request, call a service, and shape the HTTP response (status code + body). **Controllers must never query the database directly** (no Mongoose model calls, no `.find()`/`.save()`/etc.). They depend on services, not models.
- **Services** — business logic. This is the only layer that invokes Models to read/write data and where domain rules, validation logic, and orchestration live. Services return plain data/domain results to controllers, not HTTP artifacts (no `res`, no status codes).
- **Models** — Mongoose schemas and their TypeScript interface/type definitions **only**. No business logic, no request handling.

Dependency direction is one-way: Routes → Controllers → Services → Models. A layer never imports "upward" (e.g. a service must not import a controller or `express` request/response types).

## 3. Coding standards & safety

- **Explicit interfaces required.** Every function signature has explicit parameter and return types via TypeScript interfaces/types. Every DB schema has a corresponding explicit `interface` for its document shape.
- **`any` is disallowed.** Never use the `any` type (explicit or implied). Prefer precise types; use `unknown` with narrowing when a type is genuinely not known. Do not silence type errors with `any`, `as any`, or `// @ts-ignore`.
- **Async error handling — no unhandled promises.** Every `await`/promise path must handle rejection. Async controllers/handlers must forward errors to Express error-handling middleware (e.g. `try/catch` + `next(err)`, or an async wrapper util), never leaving a promise to reject unhandled. No fire-and-forget promises without explicit handling.
- These reinforce the strict compiler settings already in `tsconfig.json` (below); do not relax those settings to make code compile.

## 4. Git & commit formatting

- Keep commits focused; commit/push only when the user asks.
- **PR and diff descriptions must be concise and must state (a) what was built and (b) how the context rules in this file were applied** — e.g. which layer(s) changed and confirmation that layer boundaries, TypeScript-only, no-`any`, and async error handling were honored. Summarize; do not pad.

---

## Enforcement checklist (apply before every code change and in every review)

Before writing or accepting code, verify:
- [ ] New source files are `.ts`, and no unauthorized dependency was added.
- [ ] Code sits in the correct layer; no layer does another's job (esp. **no DB access in controllers**).
- [ ] All function signatures and schemas have explicit types/interfaces; **no `any`** and no `@ts-ignore`.
- [ ] Every async path handles errors and forwards them to Express error middleware.

If a requested change cannot satisfy all four categories, do not implement it silently — flag the conflict and propose a compliant approach.

## Commands

Only the default placeholder `test` script exists (`exit 1`); no build/dev/start/lint scripts are wired up yet. Until they are, invoke tools directly:

- Type-check without emitting: `npx tsc --noEmit`
- Run a TS file: `npx ts-node <file.ts>`
- Lint: `npx eslint .` (ESLint 10 is flat-config only — needs `eslint.config.js`; there is no `.eslintrc`)
- Format: `npx prettier --write .`

Add proper `build`/`dev`/`start`/`test`/`lint` scripts (and a test framework) to `package.json` when the work calls for them; a test framework beyond the authorized dev set requires user approval per §1.

## TypeScript constraints (already enforced by tsconfig.json — do not relax)

- **`strict`** is on; keep it on.
- **`verbatimModuleSyntax`** — use `import type { ... }` for type-only imports.
- **`module: nodenext`** — relative imports need explicit extensions (`./foo.js`, the emitted name, even from `.ts`).
- **`noUncheckedIndexedAccess`** — indexing yields `T | undefined`; narrow before use.
- **`exactOptionalPropertyTypes`** — distinguish optional from present-but-`undefined`.
- **`isolatedModules` + `moduleDetection: force`** — every file is a module.

No `rootDir`/`outDir` are set yet (commented out); when introducing a build, use `src/` → `dist/`.
