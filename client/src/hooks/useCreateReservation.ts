/**
 * Submits a new reservation and tracks the request's state.
 */
import { useRef, useState } from "react";

import { createReservation, isConflictError } from "../api/campushubApi.ts";
import type { CreateReservationDTO, Reservation } from "../types/api.ts";
import { getErrorMessage } from "../utils/errors.ts";

export const CONFLICT_MESSAGE =
  "This resource is already reserved for the selected time window.";

export type CreateReservationState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; reservation: Reservation; resourceName: string }
  | { status: "conflict"; message: string }
  | { status: "error"; message: string };

export interface UseCreateReservationResult {
  state: CreateReservationState;
  /**
   * Create the reservation. Resolves to the created reservation, or null if
   * it failed (see `state`) or another submission is already in flight.
   */
  submit: (
    payload: CreateReservationDTO,
    resourceName: string,
  ) => Promise<Reservation | null>;
  /** Clear success/error feedback. Has no effect while submitting. */
  reset: () => void;
}

export function useCreateReservation(): UseCreateReservationResult {
  const [state, setState] = useState<CreateReservationState>({
    status: "idle",
  });
  // Guards against a second submit before the "submitting" render lands.
  const inFlight = useRef<boolean>(false);

  async function submit(
    payload: CreateReservationDTO,
    resourceName: string,
  ): Promise<Reservation | null> {
    if (inFlight.current) {
      return null;
    }
    inFlight.current = true;
    setState({ status: "submitting" });
    try {
      const reservation = await createReservation(payload);
      setState({ status: "success", reservation, resourceName });
      return reservation;
    } catch (err) {
      setState(
        isConflictError(err)
          ? { status: "conflict", message: CONFLICT_MESSAGE }
          : { status: "error", message: getErrorMessage(err) },
      );
      return null;
    } finally {
      inFlight.current = false;
    }
  }

  function reset(): void {
    setState((prev: CreateReservationState): CreateReservationState =>
      prev.status === "submitting" || prev.status === "idle"
        ? prev
        : { status: "idle" },
    );
  }

  return { state, submit, reset };
}
