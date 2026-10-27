/**
 * Loads a user's reservations and cancels them.
 *
 * The last successfully loaded list is kept while a refresh is in flight or
 * after a refresh fails, so a failed reload never discards known data or
 * makes a completed cancellation look like it failed.
 */
import { useEffect, useRef, useState } from "react";

import {
  cancelReservation,
  fetchUserReservations,
} from "../api/campushubApi.ts";
import type { Reservation } from "../types/api.ts";
import { getErrorMessage } from "../utils/errors.ts";

export type CancelState =
  { status: "pending" } | { status: "error"; message: string };

export interface UseUserReservationsResult {
  /** Last successfully loaded reservations; null until the first load. */
  reservations: Reservation[] | null;
  /** True while the latest load (initial or refresh) is in flight. */
  isLoading: boolean;
  /** Error from the latest load attempt, if it failed. */
  loadError: string | null;
  reload: () => void;
  /** Per-reservation cancellation state, keyed by reservation id. */
  cancelStates: Readonly<Record<string, CancelState>>;
  /**
   * Cancel a reservation, then reload the list. Resolves to the cancelled
   * reservation, or null if it failed (see `cancelStates`) or a cancellation
   * of the same reservation is already in flight.
   */
  cancel: (reservationId: string) => Promise<Reservation | null>;
}

interface LoadedList {
  key: string;
  userId: string;
  reservations: Reservation[];
}

interface LoadFailure {
  key: string;
  message: string;
}

/**
 * @param userId - Whose reservations to load.
 * @param refreshToken - Changing this value triggers a reload (e.g. after a
 *   booking is created elsewhere on the page).
 */
export function useUserReservations(
  userId: string,
  refreshToken: number,
): UseUserReservationsResult {
  const [reloadCount, setReloadCount] = useState<number>(0);
  const [loaded, setLoaded] = useState<LoadedList | null>(null);
  const [failure, setFailure] = useState<LoadFailure | null>(null);
  const [cancelStates, setCancelStates] = useState<Record<string, CancelState>>(
    {},
  );
  const inFlightCancels = useRef<Set<string>>(new Set<string>());

  const requestKey = `${userId}:${refreshToken}:${reloadCount}`;

  useEffect((): (() => void) => {
    // Responses for a superseded request are dropped.
    let ignore = false;
    void fetchUserReservations(userId).then(
      (reservations: Reservation[]): void => {
        if (!ignore) {
          setLoaded({ key: requestKey, userId, reservations });
        }
      },
      (err: unknown): void => {
        if (!ignore) {
          setFailure({ key: requestKey, message: getErrorMessage(err) });
        }
      },
    );
    return (): void => {
      ignore = true;
    };
  }, [userId, requestKey]);

  const current = loaded !== null && loaded.userId === userId ? loaded : null;
  const loadError =
    failure !== null && failure.key === requestKey ? failure.message : null;
  const isLoading = current?.key !== requestKey && loadError === null;

  function reload(): void {
    setReloadCount((n: number): number => n + 1);
  }

  async function cancel(reservationId: string): Promise<Reservation | null> {
    if (inFlightCancels.current.has(reservationId)) {
      return null;
    }
    inFlightCancels.current.add(reservationId);
    setCancelStates(
      (prev: Record<string, CancelState>): Record<string, CancelState> => ({
        ...prev,
        [reservationId]: { status: "pending" },
      }),
    );
    try {
      const cancelled = await cancelReservation(reservationId);
      setCancelStates(
        (prev: Record<string, CancelState>): Record<string, CancelState> => {
          const next = { ...prev };
          delete next[reservationId];
          return next;
        },
      );
      // The backend lists only non-cancelled reservations, so drop it from
      // the known list right away; the reload below confirms with the server
      // and, if it fails, does not undo the successful cancellation.
      if (cancelled.status === "CANCELLED") {
        setLoaded((prev: LoadedList | null): LoadedList | null =>
          prev === null
            ? prev
            : {
                ...prev,
                reservations: prev.reservations.filter(
                  (r: Reservation): boolean => r.id !== cancelled.id,
                ),
              },
        );
      }
      reload();
      return cancelled;
    } catch (err) {
      setCancelStates(
        (prev: Record<string, CancelState>): Record<string, CancelState> => ({
          ...prev,
          [reservationId]: { status: "error", message: getErrorMessage(err) },
        }),
      );
      return null;
    } finally {
      inFlightCancels.current.delete(reservationId);
    }
  }

  return {
    reservations: current?.reservations ?? null,
    isLoading,
    loadError,
    reload,
    cancelStates,
    cancel,
  };
}
