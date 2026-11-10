# Lab 7: Backend Tests and Coverage

Jest, ts-jest, and Supertest run against `mongodb-memory-server`, so the tests
do not use Docker MongoDB or `MONGODB_URI`. Express construction (`src/app.ts`)
is now separate from startup (`src/server.ts`), which lets Supertest import
`createApp()` without connecting to a database or listening on a port.

## Commands

Run from the repository root:

```sh
npm test                      # run all tests
npx jest --coverage           # run all tests with the coverage table
npx tsc -p tsconfig.test.json # type-check production and test code
npm run build                 # compile production code; tests are excluded
```

## Results

Tests: 43 passed across 4 suites.

| Directory         | Statements | Branches |
| ----------------- | ---------- | -------- |
| `src/services`    | 98.8%      | 95.55%   |
| `src/controllers` | 100%       | 100%     |

Coverage includes every production TypeScript file in both directories,
including files no test imports.

## Known limitation: concurrent double booking

Concurrent requests for the same slot can create two reservations. This is not
fixed; the reservation write logic is unchanged.

**Probe setup:** a temporary Jest test sent two simultaneous
`POST /api/v1/reservations` requests with Supertest and `Promise.all`. Both
requests used the same slot with different users. It ran 25 trials against the
in-memory MongoDB, with a fresh resource for each trial.

**Result:**

| Outcome   | Persisted reservations | Trials |
| --------- | ---------------------- | ------ |
| 201 / 201 | 2                      | 23     |
| 201 / 409 | 1                      | 2      |

Double booking occurred in 23 of 25 trials.

**Cause:** `createReservation` in `src/services/reservation.service.ts` checks
for an overlap with `ReservationModel.exists`, then inserts separately with
`ReservationModel.create`. No unique index or transaction joins those steps, so
two requests can both pass the check before either one inserts.

**Test scope:** the probe depended on timing, so it was removed and is not part
of the test suite. The passing 409 test in
`src/routes/__tests__/reservation.routes.test.ts` covers sequential requests
only. It does not show that concurrent requests are safe.
