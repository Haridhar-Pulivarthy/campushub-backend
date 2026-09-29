/**
 * Reservation routes — route definitions only.
 *
 * Wires HTTP method + path to controller handlers per the OpenAPI contract
 * (docs/openapi.yaml). No request parsing, no business logic, no DB access.
 *
 * Endpoints:
 *   GET  /resources                 -> listResources
 *   POST /reservations              -> createReservation
 *   GET  /reservations/user/:userId -> getUserReservations
 */
import { Router } from "express";

import {
  createReservation,
  getUserReservations,
  listResources,
} from "../controllers/reservation.controller.js";

const reservationRouter: Router = Router();

reservationRouter.get("/resources", listResources);
reservationRouter.post("/reservations", createReservation);
reservationRouter.get("/reservations/user/:userId", getUserReservations);

export { reservationRouter };