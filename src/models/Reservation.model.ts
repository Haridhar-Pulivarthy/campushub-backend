/**
 * Reservation model — Mongoose schema and document interface only.
 *
 * Mirrors the `Reservation` schema in docs/openapi.yaml. The contract's `id` is
 * provided by MongoDB's `_id` (exposed by Mongoose as the virtual `id` string).
 * `resourceId` is stored as an ObjectId reference to Resource and serializes
 * to a string; `date-time` fields are stored as native Dates.
 */
import { Schema, model } from "mongoose";
import type { Model, Types } from "mongoose";

import type { ReservationStatus } from "../types/reservation.js";

/** Allowed values for Reservation.status (OpenAPI enum). */
export const RESERVATION_STATUSES: readonly ReservationStatus[] = [
  "PENDING",
  "CONFIRMED",
  "CANCELLED",
];

/** Persisted shape of a Reservation document. */
export interface IReservation {
  resourceId: Types.ObjectId;
  userId: string;
  startTime: Date;
  endTime: Date;
  status: ReservationStatus;
}

/** Mongoose model type for Reservation. */
export type ReservationModel = Model<IReservation>;

const reservationSchema = new Schema<IReservation, ReservationModel>({
  resourceId: { type: Schema.Types.ObjectId, ref: "Resource", required: true },
  userId: { type: String, required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  status: { type: String, required: true, enum: RESERVATION_STATUSES },
});

export const ReservationModel: ReservationModel = model<
  IReservation,
  ReservationModel
>("Reservation", reservationSchema);
