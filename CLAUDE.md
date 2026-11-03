# CLAUDE.md

CampusHub (CS 5500): Express 5 + Mongoose 9 backend in `src/`, React 19 + Vite client in `client/`, shared API types in `shared/`. API contract: `docs/openapi.yaml`. Setup, run, and manual checks: `README.md`. No automated tests yet. Current lab: Lab 6 (refactoring and context optimization).

These rules are course requirements. Do not weaken or trade them away; if a request conflicts, say so and propose a compliant alternative.

## 1. Stack and dependencies

- TypeScript only: no `.js`/`.jsx` under `src/` or `client/src/`. JS config files only at the repo or `client/` root, and only when the tool requires it.
- Backend (root `package.json`): `express` v5, `mongoose` v9 — APIs differ from older examples online. Dev: `typescript`, `ts-node`, `eslint`, `prettier`, `@types/*`.
- Client (`client/package.json` only): `react`, `react-dom`, built-in `fetch`. Dev: the Vite React-TS set (`vite`, `@vitejs/plugin-react`, `typescript`, `@types/react`, `@types/react-dom`, `@types/node`, `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `globals`).
- Any other package needs explicit user approval in this session. Never `npm install` to work around a problem.

## 2. Backend layers: Route → Controller → Service → Model

- Routes: method + path → middleware + controller. Nothing else.
- Controllers: read and shape-check the request, call a service, send the success status + body. Never touch models; never format error responses.
- Services: business rules and all model access. Return data; never `res`, status codes, or `express` types.
- Middleware (`src/middleware/`): cross-cutting HTTP concerns; `errorHandler.ts` is the only place errors become responses.
- Models: Mongoose schema + explicit document interface only.
- Imports flow downward only.

## 3. Types and errors

- Explicit parameter and return types on every function; an explicit interface for every schema.
- No `any`, `as any`, or `@ts-ignore`; use `unknown` + narrowing. Never relax tsconfig strictness.
- Compiler gotchas: `import type` for type-only imports; backend relative imports end in `.js` (`nodenext`); indexed access is `T | undefined`; `exactOptionalPropertyTypes` is on.
- No unhandled or fire-and-forget promises.

**Error handling (centralized):**

- Errors live in `src/services/errors.ts`: `DomainError` (carries a typed `ErrorCode`) with `ValidationError` (400), `NotFoundError` (404), `ConflictError` (409). No Express dependency.
- Controllers throw `ValidationError` for malformed requests; services throw domain errors for business rules. The thrower picks the public code, so one class serves endpoint-specific codes (`INVALID_RESERVATION`, `INVALID_RESERVATION_ID`, `INVALID_USER_ID`, …). Keep request-shape checks in controllers and business rules in services, in their current order.
- No `try/catch` in controllers: Express 5 forwards thrown errors and rejected async handlers to `src/middleware/errorHandler.ts`, registered last in `src/app.ts`. It: delegates to `next(err)` if headers were already sent; maps body-parser 4xx (malformed JSON, oversized body) to 400 `INVALID_BODY` "Request body must be valid JSON"; maps `DomainError` to its status + `{ code, message }`; otherwise logs the error and returns 500 `{ code: "INTERNAL_ERROR", message: "Internal Server Error" }` with no internals.
- Public status codes, codes, and messages are part of the contract; changing one is a contract change. Unmatched routes return 404 `{ error: "Not Found" }` (not an `ErrorResponse`); don't change it without a contract decision.

## 4. API types

- `shared/api.d.ts` is the single source of the serialized API types (`ResourceType`, `ReservationStatus`, `Resource`, `Reservation`, `CreateReservationRequest`, `ErrorResponse`), used by backend and client. Declarations only — no runtime values; the client never imports backend source.
- Import it with `import type` only. Backend: `../../shared/api.js` (from `src/<layer>/`; `nodenext` resolves it to the `.d.ts`). Client: `../../../shared/api.d.ts` (from `client/src/<dir>/`). Type-only imports are erased, so `dist/` and the Vite bundle never reference `shared/`.
- It must stay a `.d.ts`: a `.ts` file outside `src/` breaks the backend `rootDir`. Because both app tsconfigs set `skipLibCheck`, `shared/tsconfig.json` checks it on its own (`tsc -p shared`, part of the root `npm run typecheck`).
- Runtime enum arrays stay with each consumer (`src/models/*.model.ts` for Mongoose `enum`, `client/src/api/campushubApi.ts` for response guards). Shared types never replace the client's runtime validation of `unknown` responses.
- Mongoose persistence types (`src/models/`: `Types.ObjectId`, `Date`, no `id`) stay separate; services convert with `toResource`/`toReservation`.
- When the contract changes, update `openapi.yaml`, `shared/api.d.ts`, the backend, and the client guards together.

## 5. Frontend (`client/`)

- Function components only; props via `interface XxxProps`; explicit `ReactElement` return type.
- State: React hooks or custom hooks in `client/src/hooks/useXxx`. No state libraries. Components render and wire events; data loading, mutations, and form logic live in hooks (e.g. `useBookingForm` composes `useCreateReservation`).
- HTTP only through `client/src/api/campushubApi.ts`, called from hooks or event handlers — never during render or inside JSX.
- Every async flow (loading resources, creating, loading My Bookings, cancelling) shows loading, success, and error states. A 409 on create (`isConflictError`) shows distinct "slot already booked" feedback.
- Response bodies are read as `unknown` and narrowed with type guards.
- CSS Modules co-located with components; `client/src/index.css` holds only resets and design tokens; inline styles only for dynamic values; no CSS-in-JS.
- Use the relative base `/api/v1` (Vite proxies `/api` to `http://localhost:3000`). No hard-coded origins; no backend CORS.
- No auth: send `CURRENT_USER_ID` (`client/src/config/currentUser.ts`, from `VITE_CAMPUSHUB_USER_ID`, default `student-001`) as `userId`. Omit `status` on create so the backend default (`PENDING`) applies.
- Client relative imports include the source extension (`./App.tsx`).

## Commands

- Root (backend): `npm run typecheck` (backend + `tsc -p shared`), `npm run build` (`tsc`, `src/` → `dist/`), `npm start` (runs `dist/app.js`; needs `MONGODB_URI`), `npm run dev` (`tsc --watch`), `npm run format`.
- Backend lint is not configured: there is no root `eslint.config.*`, so `npm run lint` at the root does not work yet. `ts-node` is authorized but not installed.
- `client/`: `npm run typecheck`, `npm run lint`, `npm run build`, `npm run dev` (http://localhost:5173; needs the backend on 3000).

## Git

Commit or push only when asked; keep commits focused. PR and diff descriptions are concise and state (a) what was built and (b) how these rules were applied (layers touched; TypeScript-only, no `any`, and error handling honored).

## Context

- `.claude/settings.json` denies Claude's file-reading tools access to dependencies, build output, coverage, lockfiles, logs, source maps, and `*.tsbuildinfo`. Those rules block Read/Edit/Write, `@` mentions, and recognized shell file commands (`cat`, `head`, `tail`, `sed`) on those paths. Filtering of Grep/Glob results is best-effort only, and the rules do not stop commands that read files without naming them (`grep -r`, `npm`, `tsc`). Don't work around them; ask if a task really needs one of those files.
- Historical lab records (`docs/lab4-steering-log.md`, `docs/lab5-verification.md`) are background only: don't read them unless the task is about them.
