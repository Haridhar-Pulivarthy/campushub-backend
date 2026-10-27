# Lab 5 Verification Record

Lab 5 added the React + TypeScript + Vite client (`client/`), the typed API
layer, and the ResourceList, BookingForm, and UserReservations components.
This record separates checks run automatically by the coding agent from the
manual browser audit performed by the student. Environment: Windows 11,
Node 24.19.0, MongoDB 8 in the `campushub-mongo` Docker container, browser
time zone America/Los_Angeles.

## Automated checks (run by the coding agent)

| Check                                           | Result                     |
| ----------------------------------------------- | -------------------------- |
| Backend `npm run typecheck` (`tsc --noEmit`)    | Pass (exit 0)              |
| Backend `npm run build` (`tsc`)                 | Pass (exit 0)              |
| Client `npm run typecheck` (`tsc -b`)           | Pass (exit 0)              |
| Client `npm run lint` (`--max-warnings 0`)      | Pass (exit 0, no warnings) |
| Client `npm run build` (`tsc -b && vite build`) | Pass (exit 0)              |

Each was run at the end of Parts 1 and 2 and again before the final commit.

Additional runtime checks during development (read-only; not a browser):

- **Vite proxy (Part 1):** `curl` through `localhost:5173` returned the three
  existing resources, the `type=ROOM` filter returned one, an invalid type
  returned `400 INVALID_TYPE`, and user reservations returned `[]` for
  `student-001` and the one existing `PENDING` reservation for `u1`.
- **API layer and utilities (Part 2):** a throwaway Node script (not
  committed) imported `campushubApi.ts` and `datetime.ts` directly, with
  `fetch` pointed at the Vite proxy. It confirmed response validation for
  `fetchResources` (all / ROOM / LAB) and `fetchUserReservations`, `ApiError`
  mapping for 400 and network failure (status 0), `isConflictError` for 409,
  and datetime-local → ISO conversion in local time, including both 2026 DST
  transition dates and rejection of impossible dates.

The agent had no browser tooling, so it did not test any component behavior.
No reservations were created or cancelled by automated checks.

## Manual browser audit (performed by the student)

All items passed:

| Area                                                   | Result |
| ------------------------------------------------------ | ------ |
| Resource loading and type filters                      | Pass   |
| Empty My Bookings state                                | Pass   |
| Required-field and time-order validation               | Pass   |
| Successful creation with correct local-time display    | Pass   |
| Duplicate booking shows explicit 409 conflict feedback | Pass   |
| Cancellation refreshes the list                        | Pass   |
| Rebooking a cancelled slot succeeds                    | Pass   |
| Final cancellation persists after a page refresh       | Pass   |
| Responsive layout                                      | Pass   |
| Backend connection error and retry recovery            | Pass   |

## Not covered

- There are no automated component or end-to-end tests. Adding a test
  framework would require approving a new dependency (`CLAUDE.md` §1).
- There is no authentication or ownership check: any `userId` can cancel any
  reservation by id. This is a known limitation of the current backend.
