# CampusHub

Campus resource reservation system for CS 5500. This repository holds both
parts of the app:

| Path      | What                                                          |
| --------- | ------------------------------------------------------------- |
| `src/`    | Backend — Express 5 + Mongoose 9 (TypeScript), port 3000      |
| `client/` | Frontend — React 19 + TypeScript + Vite, port 5173            |
| `docs/`   | OpenAPI contract (`openapi.yaml`), steering and audit records |

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
# Backend (repository root)
npm run typecheck
npm run build

# Frontend
cd client
npm run typecheck
npm run lint
npm run build
```

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
recorded in `docs/lab5-verification.md`.
