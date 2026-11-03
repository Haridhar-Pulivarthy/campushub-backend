# Lab 6 Refactoring Record

Lab 6 optimized the AI context for this repository and refactored three areas
found in a read-only audit: duplicated API types, repeated controller error
handling, and mixed responsibilities in the booking form. Public API behavior
is unchanged. Unless noted, checks were run by the coding agent (Claude Code
2.1.317) on Windows 11; the manual browser checks were run by the student.

## 1. Context optimization

`CLAUDE.md` was rewritten to remove stale and repeated instructions while
keeping every course rule (authorized dependencies, layering, TypeScript
strictness, frontend behavior, API contract).

| Version                            | Lines | Bytes  |
| ---------------------------------- | ----- | ------ |
| Before Lab 6                       | 99    | 10,954 |
| After Part 1 (context revision)    | 64    | 6,442  |
| Final (after architecture updates) | 71    | 7,685  |

Byte counts are for LF line endings in the working copy (the original file
had CRLF). The final version grew because it now documents the implemented
shared-type layer, centralized error handling, and hook structure.

Removed or corrected:

- Stale commands: "only a placeholder `test` script exists" (the root
  `package.json` already had `build`, `start`, `dev`, `typecheck`, `lint`,
  `format`); `npx ts-node` (not installed); `npx eslint .` (no root ESLint
  config); "no `rootDir`/`outDir` yet" (already `src/` → `dist/`).
- Repetition: an enforcement checklist restating §1–4, a section restating
  `tsconfig.json`, and setup details already in `README.md`.

No before/after token usage was measured. A bytes ÷ 4 heuristic suggests
roughly 2.7k → 1.9k tokens for `CLAUDE.md`, but that is an estimate only.

## 2. Context exclusions

Claude Code does not read `.claudeignore`, `.cursorignore`, or `.ignore`
files, so none were added. The tool equivalent used is
`.claude/settings.json`: 13 `permissions.deny` `Read(...)` rules covering
`node_modules/`, `dist/`, `dist-ssr/`, `build/`, `coverage/`, npm/yarn/pnpm
lockfiles, `*.log`, `logs/`, `*.map`, and `*.tsbuildinfo`. Source, package
manifests, configuration, and `docs/openapi.yaml` stay readable. Historical
lab records are excluded by guidance in `CLAUDE.md` only, so they remain
available when a task needs them.

What the rules control: Claude's Read/Edit/Write tools, `@` mentions, and
shell commands that name a denied file (`cat`, `head`, `tail`, `sed`). They
do not guarantee exclusion from Grep/Glob results (best-effort per the
documentation) or from commands that read files without naming them
(`grep -r`, `npm`, `tsc`). Claude Code's OS-level sandbox is not available on
native Windows.

Checks performed:

- Read of `client/package-lock.json` and `dist/app.js`: both denied ("File is
  in a directory that is denied by your permission settings"). Neither was
  retried through another tool.
- Read of `src/app.ts`, `client/package.json`, and `docs/openapi.yaml`: all
  readable.
- A source-only query (find the four booking-flow entry points) was answered
  with searches scoped to `src/` and `client/src/`.
- During the later audit, a shell command that referenced `node_modules/` was
  also denied.

These probes show the rules are active for Claude's file tools; they do not
show that every possible read path is blocked, and Glob filtering was not
re-tested after the rules were added.

## 3. Audit findings and changes

| Finding                                                                                                   | Change                                                                  |
| --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| API types defined twice (`src/types/reservation.ts`, `client/src/types/api.ts`), plus two request types   | One shared declaration file, `shared/api.d.ts`                          |
| Four controller `try/catch` blocks and duplicated `errorBody`/`sendInternalError` helpers                 | Coded domain errors and one error middleware                            |
| `BookingForm.tsx` mixed form state, validation, time conversion, request building, submission, and render | Logic moved to `useBookingForm`; the component renders and wires events |

## 4. Shared API types

- `shared/api.d.ts` declares the serialized API types: `ResourceType`,
  `ReservationStatus`, `Resource`, `Reservation`, `CreateReservationRequest`,
  `ErrorResponse`. Fields, optionality (`status?`), and allowed values match
  the previous copies and `docs/openapi.yaml`.
- Both sides use `import type` (backend `../../shared/api.js`, client
  `../../../shared/api.d.ts`), so compiled output never references `shared/`.
- It is a `.d.ts` because a `.ts` file outside `src/` would break the backend
  `rootDir`. Both app tsconfigs set `skipLibCheck`, which skips errors inside
  `.d.ts` files, so `shared/tsconfig.json` checks it strictly on its own
  (`skipLibCheck: false`) as part of the root `npm run typecheck`. A scratch
  file with an undefined type passed with `skipLibCheck: true` and failed
  under this config.
- The backend `CreateReservationInput` and client `CreateReservationDTO` had
  identical fields and meaning and were merged into `CreateReservationRequest`.
  The controller still reads the raw body as `unknown`.
- Runtime enum arrays stay with each consumer (Mongoose `enum` in the models,
  response guards in `client/src/api/campushubApi.ts`). The client still
  validates every response at runtime.
- Mongoose persistence types (`ObjectId`, `Date`, no `id`) remain separate in
  `src/models/`; services convert with `toResource`/`toReservation`.

## 5. Centralized error handling

- `src/services/errors.ts`: `DomainError` carries a typed public `code`;
  `ValidationError` (400), `NotFoundError` (404), `ConflictError` (409). No
  Express dependency. The thrower chooses the code, which preserves
  endpoint-specific codes (`INVALID_RESERVATION`, `INVALID_RESERVATION_ID`,
  `INVALID_USER_ID`).
- Controllers keep request-shape checks and throw `ValidationError`; services
  keep business rules. Validation order is unchanged. Controllers have no
  `try/catch`: Express 5 forwards thrown errors and rejected async handlers.
- `src/middleware/errorHandler.ts`, registered last in `src/app.ts`:
  delegates to `next(err)` if headers were already sent; maps body-parser 4xx
  errors to 400 `INVALID_BODY`; maps domain errors to their status and
  `{ code, message }`; logs anything else and returns only
  `500 { "code": "INTERNAL_ERROR", "message": "Internal Server Error" }`.
- Unmatched routes still return `404 { "error": "Not Found" }`.

## 6. Frontend hooks

- New `client/src/hooks/useBookingForm.ts`: input state, validation, local
  datetime → ISO conversion, request construction, double-submit guard,
  feedback reset on resource change (entered times are kept), and the
  `onBooked` callback. It composes `useCreateReservation`, which still owns
  the API call and request state (including 409 conflict detection).
- `BookingForm.tsx` went from 275 to 175 lines and now only renders.
- Data access was already in hooks: `useResources` (resource list),
  `useCreateReservation` (create), and `useUserReservations` (load, refresh,
  cancel). `UserReservations.tsx` contains only display-derived data and a
  cancellation notice, so it was not split further.
- No generic fetching hook or filename-only wrapper (e.g. `useReservations.ts`)
  was added: the two loading hooks have different semantics
  (`useUserReservations` keeps the last good list and edits it on cancel), so
  a shared abstraction would mainly relocate code.

## 7. Verification

| Check                                                                                   | Result                                                                | By      |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------- |
| Root `npm run typecheck` (backend + `tsc -p shared`), root `npm run build`              | Pass before Lab 6 code changes and after the type and error refactors | Agent   |
| Client `npm run typecheck`, `npm run lint`, `npm run build`                             | Pass before Lab 6 code changes and after the type and hook refactors  | Agent   |
| Compiled backend startup and `GET /api/v1/health` (port 3100)                           | 200 after the shared-type change                                      | Agent   |
| 41 HTTP cases before vs. after the error refactor (status + parsed, normalized body)    | All identical                                                         | Agent   |
| Isolated test app with the compiled middleware and real routes (19 checks)              | All passed                                                            | Agent   |
| Temporary database fixtures                                                             | Removed; counts unchanged (3 resources, 1 reservation)                | Agent   |
| Manual browser checks of booking, validation, conflict, cancellation, refresh, recovery | Passed (reported by the student)                                      | Student |

The 41 HTTP cases covered health, resource listing and filters, every
request-shape and semantic validation error, malformed/`null`/oversized JSON,
conflicts, listing, cancellation (valid, repeated, invalid, missing), and
unmatched routes. The isolated app checked sanitized 500s and server-side
logging for async throws, rejected promises, sync throws, and non-`Error`
throws; `headersSent` delegation; and a real controller rejection (Mongoose
deliberately not connected), without adding a production failure route or
stopping MongoDB. Probe and harness scripts lived in a scratch directory
outside the repository and are not committed.

## 8. Limitations

- No automated browser or unit test suite; UI behavior was verified manually.
- No measured token savings; only file-size changes are recorded.
- Backend lint remains unconfigured (no root `eslint.config.*`), as before
  Lab 6.
- The exclusion probes were limited to the cases above.
- `tsc` does not delete stale output, so an old `dist/types/` build artifact
  may remain locally; nothing references it, and `dist/` is not tracked.
