/**
 * Reservation routes — route definitions only.
 *
 * Wires HTTP method + path to controller handlers per the OpenAPI contract
 * (docs/openapi.yaml). No request parsing, no business logic, no DB access.
 *
 * Endpoints:
 *   GET  /resources                 -> resource.controller listResources
 *   POST /reservations              -> reservation.controller createReservation
 *   GET  /reservations/user/:userId -> reservation.controller getUserReservations
 *   PATCH /reservations/:id/cancel  -> reservation.controller cancelReservation
 */
import { Router } from "express";

import {
  cancelReservation,
  createReservation,
  getUserReservations,
} from "../controllers/reservation.controller.js";
import { listResources } from "../controllers/resource.controller.js";

const reservationRouter: Router = Router();

reservationRouter.get("/resources", listResources);
reservationRouter.post("/reservations", createReservation);
reservationRouter.get("/reservations/user/:userId", getUserReservations);
reservationRouter.patch("/reservations/:id/cancel", cancelReservation);

export { reservationRouter };
