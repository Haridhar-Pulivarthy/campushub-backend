# CampusHub

Campus resource reservation system for CS 5500. This repository holds both
parts of the app:

| Path      | What                                                                                                                                                                      |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/`    | Backend — Express 5 + Mongoose 9 (TypeScript), port 3000; domain errors in `services/errors.ts`, one error handler in `middleware/errorHandler.ts`                        |
| `client/` | Frontend — React 19 + TypeScript + Vite, port 5173; data and form logic in `src/hooks/` (`useResources`, `useCreateReservation`, `useUserReservations`, `useBookingForm`) |
| `shared/` | API types used by both backend and client (`api.d.ts`, declarations only)                                                                                                 |
| `docs/`   | OpenAPI contract (`openapi.yaml`), steering, verification, and refactoring records                                                                                        |

Project rules for contributors (and AI assistants) are in `CLAUDE.md`.

## Prerequisites

- **Node.js 24** (developed with 24.19.0 / npm 12)
- **Docker Desktop**, for the MongoDB 8 container
- Windows PowerShell (commands below); other shells work with equivalent syntax

## First-time setup

```powershell
# From the repository root
npm install
cd client
npm install
cd ..

# Create the MongoDB container (skip if campushub-mongo already exists)
docker run -d --name campushub-mongo -p 27017:27017 mongo:8
```

A new database has no resources to book. There is no seed script; add a few
with `mongosh` inside the container if needed:

```powershell
docker exec campushub-mongo mongosh campushub --quiet --eval 'db.resources.insertMany([{name:"Study Room 101",type:"ROOM",location:"Library - First Floor",isAvailable:true},{name:"Projector 201",type:"EQUIPMENT",location:"Media Services",isAvailable:true},{name:"Computer Lab A",type:"LAB",location:"Engineering Building",isAvailable:true}])'
```

## Running locally

Use two terminals.

```powershell
# Terminal 1 — database + backend (repository root)
docker start campushub-mongo
$env:MONGODB_URI = "mongodb://localhost:27017/campushub"
npm run build; if ($?) { npm start }      # http://localhost:3000/api/v1
```

```powershell
# Terminal 2 — frontend
cd client
npm run dev                                # open http://localhost:5173
```

`MONGODB_URI` is required; the backend exits with `MissingEnvError` if it is
not set in that terminal.

### How the frontend reaches the backend

The client calls the relative path `/api/v1/...`. In development, the Vite dev
server proxies every `/api` request to `http://localhost:3000`
(`client/vite.config.ts`), so the browser only talks to `localhost:5173` and
the backend needs no CORS configuration. The backend must be running for the
UI to load data; if it is not, the UI shows a connection error with a Retry
button.

### Demo user

There is no authentication. The UI books and lists reservations as
**`student-001`** by default. To act as a different student, create
`client/.env.local` (git-ignored) and restart `npm run dev`:

```
VITE_CAMPUSHUB_USER_ID=u1
```

## API

Base URL `http://localhost:3000/api/v1`; full contract in `docs/openapi.yaml`.

| Method | Path                         | Purpose                                     |
| ------ | ---------------------------- | ------------------------------------------- |
| GET    | `/resources?type=`           | List resources (`ROOM`, `EQUIPMENT`, `LAB`) |
| POST   | `/reservations`              | Create a reservation (409 on time conflict) |
| GET    | `/reservations/user/:userId` | A user's non-cancelled reservations         |
| PATCH  | `/reservations/:id/cancel`   | Cancel a reservation (idempotent)           |

## Verification

Automated checks:

```powershell
# Backend (repository root); typecheck also checks shared/api.d.ts
npm run typecheck
npm run lint
npm run build

# Frontend
cd client
npm run typecheck
npm run lint
npm run build
```

### End-to-end tests (Playwright)

```powershell
# One-time: download the browsers (about 500 MB)
npx playwright install chromium firefox webkit

# Stop any dev servers on 3000/5173 first, then:
npm run test:e2e                           # all browsers; same as: npx playwright test
npx playwright test --project=firefox      # one browser (chromium | firefox | webkit)
npx playwright show-report                 # open the last HTML report
npx playwright test --ui                   # interactive UI mode
```

- **Servers:** Playwright builds and starts the backend on 3000 and the Vite
  dev server on 5173, runs `e2e/**/*.spec.ts` with one worker, then stops
  both. If either port is busy the run fails rather than reuse that server.
- **Database:** the backend runs through `e2e/support/start-api.ts` against an
  in-memory MongoDB, `campushub_e2e`, on `127.0.0.1:27027` (must be free; the
  launcher refuses to start otherwise). Any `MONGODB_URI` in the shell is
  ignored, so the development database and Docker are never used.
- **Fixtures:** `e2e/reservation.spec.ts` implements
  `e2e/scenarios/reservation.feature` (each Gherkin step is a `test.step`).
  Its `db` fixture (`e2e/support/fixtures.ts`) connects only after confirming
  that the server is the E2E instance (host, port, database name, and data
  directory), empties the reservations and resources before every test
  (each browser, repeat, and retry), and seeds that scenario's data. Bookings
  themselves always go through the browser.
- **Locale and time zone:** browsers run in `en-US` / `America/Los_Angeles`,
  and booking times are always "tomorrow" in that zone, so results do not
  depend on the host's time zone or the date.
- **Output:** `test-results/` (traces kept for failed tests) and
  `playwright-report/`, both git-ignored.

Known limitations:

- **WebKit on Windows:** during repeated runs the WebKit conflict test timed
  out twice in 28 executions (2026-11). Both times `locator.click` on "Book
  resource" stalled at "scrolling into view if needed" after the button was
  visible, enabled, and stable, and no `POST /api/v1/reservations` reached
  the app. This points at the WebKit driver rather than CampusHub, but the
  root cause has not been established. The test is left unchanged (no
  retries, longer timeouts, or skips); rerun and inspect the trace if it
  recurs.
- **Slow mongod start:** once (2026-11-24) the run aborted before any test
  with `GenericMMSError: Instance failed to start within 10000ms`; mongod
  normally starts in about a second, and the next run passed. If it recurs,
  rerun and check what else is loading the machine.
- **One run at a time:** mongod uses the fixed directory
  `%TEMP%\campushub-e2e-mongo`, wiped at the start of each run. Windows
  force-stops the launcher, so one run's files (about 160 MB) remain until
  the next run. Do not start two E2E runs at once: on Windows the second
  fails on the busy ports; on macOS/Linux it could wipe the first run's data
  directory before failing.

Proxy smoke test, with both servers running (read-only):

```powershell
curl.exe -i "http://localhost:5173/api/v1/resources?type=ROOM"
curl.exe -i "http://localhost:5173/api/v1/reservations/user/student-001"
```

Manual browser checks: load the directory and switch type filters; submit the
form empty and with the end before the start; book a slot and confirm it
appears in My Bookings with the correct local times; book the same slot again
and confirm the 409 conflict message; cancel and confirm the list refreshes;
stop the backend and confirm the error and Retry recovery.

Lab 5 results — which checks were automated and which were manual — are
recorded in `docs/lab5-verification.md`. Lab 6 context optimization,
refactoring, and verification are recorded in
[`docs/lab6-refactoring.md`](docs/lab6-refactoring.md).

`npm run lint` at the repository root lints the backend (`eslint.config.js`);
`client/` is linted separately from `client/`. GitHub Actions
(`.github/workflows/ci.yml`) runs both lints and the Jest suite on pushes and
pull requests to `main`. When Jest fails on a same-repository PR, an auto-heal
job attempts one verified AI repair and opens a PR into that PR's branch; setup
(the `ANTHROPIC_API_KEY` secret and a repository setting) is in
[`docs/lab8-auto-heal.md`](docs/lab8-auto-heal.md).
