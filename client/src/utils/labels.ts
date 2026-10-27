/**
 * Display labels for API enum values.
 */
import type { ReservationStatus, ResourceType } from "../types/api.ts";

export const RESOURCE_TYPE_LABELS: Readonly<Record<ResourceType, string>> = {
  ROOM: "Room",
  EQUIPMENT: "Equipment",
  LAB: "Lab",
};

export const RESERVATION_STATUS_LABELS: Readonly<
  Record<ReservationStatus, string>
> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
};
