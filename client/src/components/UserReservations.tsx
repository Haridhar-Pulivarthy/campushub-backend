/**
 * My Bookings: the current student's non-cancelled reservations (past ones
 * included, as returned by the backend) with per-reservation cancellation.
 */
import { useMemo, useState } from "react";
import type { ReactElement } from "react";

import { useResources } from "../hooks/useResources.ts";
import { useUserReservations } from "../hooks/useUserReservations.ts";
import type { CancelState } from "../hooks/useUserReservations.ts";
import type { Reservation, Resource } from "../types/api.ts";
import { formatDateTime } from "../utils/datetime.ts";
import { RESERVATION_STATUS_LABELS } from "../utils/labels.ts";
import StatusMessage from "./StatusMessage.tsx";
import styles from "./UserReservations.module.css";

export interface UserReservationsProps {
  userId: string;
  /** Changing this value reloads the list (e.g. after a new booking). */
  refreshToken: number;
}

interface ReservationItemProps {
  reservation: Reservation;
  resourceName: string;
  cancelState: CancelState | undefined;
  onCancel: (reservation: Reservation, resourceName: string) => void;
}

function ReservationItem({
  reservation,
  resourceName,
  cancelState,
  onCancel,
}: ReservationItemProps): ReactElement {
  const isCancelling = cancelState?.status === "pending";
  const start = formatDateTime(reservation.startTime);
  const end = formatDateTime(reservation.endTime);

  return (
    <li className={styles.item}>
      <div className={styles.itemHeader}>
        <h3 className={styles.name}>{resourceName}</h3>
        <span className={`${styles.status} ${styles[reservation.status]}`}>
          {RESERVATION_STATUS_LABELS[reservation.status]}
        </span>
      </div>
      <dl className={styles.times}>
        <div>
          <dt>Start</dt>
          <dd>
            <time dateTime={reservation.startTime}>{start}</time>
          </dd>
        </div>
        <div>
          <dt>End</dt>
          <dd>
            <time dateTime={reservation.endTime}>{end}</time>
          </dd>
        </div>
      </dl>
      <button
        type="button"
        className={styles.cancelButton}
        disabled={isCancelling}
        aria-label={`Cancel reservation for ${resourceName} starting ${start}`}
        onClick={(): void => {
          onCancel(reservation, resourceName);
        }}
      >
        {isCancelling ? "Cancelling…" : "Cancel Reservation"}
      </button>
      {cancelState?.status === "error" && (
        <StatusMessage kind="error">
          Could not cancel this reservation. {cancelState.message}
        </StatusMessage>
      )}
    </li>
  );
}

function UserReservations({
  userId,
  refreshToken,
}: UserReservationsProps): ReactElement {
  const { reservations, isLoading, loadError, reload, cancelStates, cancel } =
    useUserReservations(userId, refreshToken);
  // Names come from the full, unfiltered resource list so they do not depend
  // on the directory's current type filter.
  const { state: resourcesState, retry: retryResources } = useResources();
  const [notice, setNotice] = useState<string | null>(null);

  const resourceNames = useMemo((): ReadonlyMap<string, string> => {
    if (resourcesState.status !== "success") {
      return new Map<string, string>();
    }
    return new Map(
      resourcesState.resources.map((r: Resource): [string, string] => [
        r.id,
        r.name,
      ]),
    );
  }, [resourcesState]);

  const sortedReservations = useMemo((): Reservation[] | null => {
    if (reservations === null) {
      return null;
    }
    return [...reservations].sort(
      (a: Reservation, b: Reservation): number =>
        Date.parse(a.startTime) - Date.parse(b.startTime),
    );
  }, [reservations]);

  function nameFor(reservation: Reservation): string {
    return resourceNames.get(reservation.resourceId) ?? reservation.resourceId;
  }

  async function handleCancel(
    reservation: Reservation,
    resourceName: string,
  ): Promise<void> {
    setNotice(null);
    const cancelled = await cancel(reservation.id);
    if (cancelled !== null) {
      setNotice(
        `Cancelled your reservation for ${resourceName} starting ${formatDateTime(cancelled.startTime)}.`,
      );
    }
  }

  let content: ReactElement;
  if (sortedReservations === null) {
    content =
      loadError !== null ? (
        <StatusMessage
          kind="error"
          action={{ label: "Retry", onClick: reload }}
        >
          Could not load your bookings. {loadError}
        </StatusMessage>
      ) : (
        <StatusMessage kind="info">Loading your bookings…</StatusMessage>
      );
  } else {
    content = (
      <>
        {loadError !== null && (
          <StatusMessage
            kind="warning"
            action={{ label: "Retry", onClick: reload }}
          >
            Could not refresh your bookings ({loadError}). Showing the last
            loaded list.
          </StatusMessage>
        )}
        {isLoading && (
          <StatusMessage kind="info">Refreshing your bookings…</StatusMessage>
        )}
        {sortedReservations.length === 0 ? (
          <StatusMessage kind="info">
            You have no active bookings. Reserve a resource above to see it
            here.
          </StatusMessage>
        ) : (
          <ul className={styles.list} aria-label="Your reservations">
            {sortedReservations.map(
              (reservation: Reservation): ReactElement => (
                <ReservationItem
                  key={reservation.id}
                  reservation={reservation}
                  resourceName={nameFor(reservation)}
                  cancelState={cancelStates[reservation.id]}
                  onCancel={(r: Reservation, name: string): void => {
                    void handleCancel(r, name);
                  }}
                />
              ),
            )}
          </ul>
        )}
      </>
    );
  }

  return (
    <section className={styles.section} aria-labelledby="bookings-heading">
      <h2 id="bookings-heading" className={styles.heading}>
        My Bookings
      </h2>
      <p className={styles.hint}>
        Active (pending or confirmed) reservations for <strong>{userId}</strong>
        , including past ones.
      </p>
      {notice !== null && (
        <StatusMessage kind="success">{notice}</StatusMessage>
      )}
      {resourcesState.status === "error" && (
        <StatusMessage
          kind="warning"
          action={{ label: "Retry", onClick: retryResources }}
        >
          Resource names could not be loaded, so resource IDs are shown instead.
        </StatusMessage>
      )}
      {content}
    </section>
  );
}

export default UserReservations;
