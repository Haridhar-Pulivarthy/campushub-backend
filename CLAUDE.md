# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

CampusHub is a backend for the CS 5500 course project. The constraints below are **course requirements**, not style suggestions. Treat them as hard rules: do not weaken, reinterpret, or trade any of them away for convenience, and refuse requests that would violate them (explain the conflict and offer a compliant alternative).

## Project state

As of Lab 5: the backend (`src/`) implements the reservation API in `docs/openapi.yaml`, and the React client (`client/`) provides the resource directory, booking form, and My Bookings views. Startup and verification steps are in `README.md`; there are no automated tests yet. Follow the conventions already established in the code and this file.

---

## 1. Tech stack & libraries (authorized packages only)

- **Language:** TypeScript **only**. Do **not** create `.js` (or `.jsx`) source files anywhere under the application source (`src/` and `client/src/`). Raw JavaScript is forbidden. (Config files that must be JS, e.g. `eslint.config.js`, are the sole exception and live at the repo root or the `client/` root, never in source. Prefer a `.ts` config where the tool supports it, e.g. `client/vite.config.ts`.)
- **Backend** (root `package.json`):
  - **Authorized runtime dependencies:** `express` (v5), `mongoose` (v9). Nothing else.
  - **Authorized dev dependencies:** `typescript`, `ts-node`, `eslint`, `prettier`, `@types/*` for the above.
- **Frontend** (`client/package.json` only — never add these to the root):
  - **Authorized runtime dependencies:** `react`, `react-dom`. Nothing else. Use the built-in `fetch` for HTTP (no axios, no data-fetching or schema-validation libraries).
  - **Authorized dev dependencies:** `vite`, `@vitejs/plugin-react`, `typescript`, `@types/react`, `@types/react-dom`, `@types/node` (Vite config only), and the Vite React-TS lint set: `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `globals`.
- **Adding any other library is forbidden** (backend or frontend) unless the user explicitly authorizes it in this session. Do not `npm install` a new package to solve a problem — solve it with the authorized set, or stop and ask. If you believe a new dependency is genuinely necessary, propose it and wait for approval before installing.
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
- **Async error handling — no unhandled promises.** Every `await`/promise path must handle rejection. Async controllers must wrap service calls in `try/catch`, map known domain errors to their 4xx responses, and respond to any unexpected error themselves with the OpenAPI `500` `ErrorResponse` (`{ code, message }`, no internal details leaked) — per the Lab 3 rubric, controllers own all HTTP response formatting, including 500s. Never leave a promise to reject unhandled. The centralized error middleware in `app.ts` remains as a backstop for errors raised outside controllers (e.g. body parsing). No fire-and-forget promises without explicit handling.
- These reinforce the strict compiler settings already in `tsconfig.json` (below); do not relax those settings to make code compile.

## 4. Frontend (`client/`)

React 19 + TypeScript + Vite app in `client/`, with its own `package.json` and `tsconfig*.json`. §1 and §3 apply here too: TypeScript only, no `any` / `as any` / `@ts-ignore`, explicit types on every function signature, no unhandled promises.

- **Components:** functional components only (no class components). Every component that takes props declares an explicit `interface <Name>Props` and an explicit return type (`ReactElement`).
- **State:** standard React hooks (`useState`, `useEffect`, `useReducer`, `useMemo`, …) or custom hooks in `client/src/hooks/` (`useXxx`). No external state-management libraries.
- **No API calls inside JSX.** All HTTP goes through the typed methods in `client/src/api/campushubApi.ts`; components never call `fetch` directly. API methods are invoked from hooks or event handlers, never inline in JSX expressions or during render.
- **Async UI states:** every async workflow (loading resources, creating a reservation, loading My Bookings, cancelling) renders explicit loading, success, and error states. A `409` on reservation creation (`isConflictError`) shows explicit conflict feedback (the slot is already booked), distinct from generic errors.
- **Styling:** CSS Modules (`Component.module.css`, co-located with the component). `client/src/index.css` holds only global resets and design tokens (CSS custom properties). No inline style objects except for truly dynamic values; no CSS-in-JS libraries.
- **API types:** `client/src/types/api.ts` mirrors `docs/openapi.yaml` by hand (the client never imports backend source). When the contract changes, update `openapi.yaml`, the backend, and these types together. Response bodies are read as `unknown` and narrowed with type guards before use.
- **Backend access:** the client calls the relative base path `/api/v1`; in development, Vite proxies `/api` to `http://localhost:3000` (`client/vite.config.ts`). Do not hard-code backend origins in source and do not add CORS to the backend for local development.
- **Current student:** there is no authentication. `CURRENT_USER_ID` (`client/src/config/currentUser.ts`) comes from `VITE_CAMPUSHUB_USER_ID`, falling back to `student-001`, and is sent as `userId`. Booking requests omit `status` so the backend default (`PENDING`) applies.
- **Imports:** the client uses bundler module resolution; relative imports include the source extension (`./App.tsx`, `../types/api.ts`). The backend's `nodenext` `.js`-extension rule does not apply in `client/`.

## 5. Git & commit formatting

- Keep commits focused; commit/push only when the user asks.
- **PR and diff descriptions must be concise and must state (a) what was built and (b) how the context rules in this file were applied** — e.g. which layer(s) changed and confirmation that layer boundaries, TypeScript-only, no-`any`, and async error handling were honored. Summarize; do not pad.

---

## Enforcement checklist (apply before every code change and in every review)

Before writing or accepting code, verify:
- [ ] New source files are `.ts`, and no unauthorized dependency was added.
- [ ] Code sits in the correct layer; no layer does another's job (esp. **no DB access in controllers**).
- [ ] All function signatures and schemas have explicit types/interfaces; **no `any`** and no `@ts-ignore`.
- [ ] Every async path handles errors; controllers catch unexpected errors and respond with the 500 `ErrorResponse`.
- [ ] Frontend changes follow §4: functional components with explicit props interfaces, hooks for state, API calls only via `campushubApi.ts` (never in JSX), CSS Modules, and loading/success/error states (with explicit 409 feedback) for every async workflow.

If a requested change cannot satisfy all four categories, do not implement it silently — flag the conflict and propose a compliant approach.

## Commands

Only the default placeholder `test` script exists (`exit 1`); no build/dev/start/lint scripts are wired up yet. Until they are, invoke tools directly:

- Type-check without emitting: `npx tsc --noEmit`
- Run a TS file: `npx ts-node <file.ts>`
- Lint: `npx eslint .` (ESLint 10 is flat-config only — needs `eslint.config.js`; there is no `.eslintrc`)
- Format: `npx prettier --write .`

Add proper `build`/`dev`/`start`/`test`/`lint` scripts (and a test framework) to `package.json` when the work calls for them; a test framework beyond the authorized dev set requires user approval per §1.

Frontend (run inside `client/`): `npm run dev` (http://localhost:5173, needs the backend on port 3000), `npm run typecheck`, `npm run lint`, `npm run build`.

## TypeScript constraints (already enforced by tsconfig.json — do not relax)

These apply to the backend `tsconfig.json` (which compiles only `src/`). `client/tsconfig.app.json` keeps the same strictness flags (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `isolatedModules`, `moduleDetection: force`) but uses `module: esnext` with bundler resolution instead of `nodenext`.

- **`strict`** is on; keep it on.
- **`verbatimModuleSyntax`** — use `import type { ... }` for type-only imports.
- **`module: nodenext`** — relative imports need explicit extensions (`./foo.js`, the emitted name, even from `.ts`).
- **`noUncheckedIndexedAccess`** — indexing yields `T | undefined`; narrow before use.
- **`exactOptionalPropertyTypes`** — distinguish optional from present-but-`undefined`.
- **`isolatedModules` + `moduleDetection: force`** — every file is a module.

No `rootDir`/`outDir` are set yet (commented out); when introducing a build, use `src/` → `dist/`.
