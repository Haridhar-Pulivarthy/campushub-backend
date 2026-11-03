/**
 * Booking form for the selected resource. Renders the time-window inputs and
 * the success, conflict (409), and error feedback; form state, validation,
 * and submission live in useBookingForm.
 */
import { useId } from "react";
import type { ChangeEvent, FormEvent, ReactElement } from "react";

import type { Reservation, Resource } from "../../../shared/api.d.ts";
import { useBookingForm } from "../hooks/useBookingForm.ts";
import { formatDateTime } from "../utils/datetime.ts";
import {
  RESERVATION_STATUS_LABELS,
  RESOURCE_TYPE_LABELS,
} from "../utils/labels.ts";
import styles from "./BookingForm.module.css";
import StatusMessage from "./StatusMessage.tsx";

export interface BookingFormProps {
  /** The resource chosen in the directory, or null if none is selected. */
  resource: Resource | null;
  /** Sent as the reservation's userId. */
  userId: string;
  /** Called once a reservation has been created. */
  onBooked: (reservation: Reservation) => void;
}

function BookingForm({
  resource,
  userId,
  onBooked,
}: BookingFormProps): ReactElement {
  const startId = useId();
  const endId = useId();
  const resourceErrorId = useId();
  const startErrorId = useId();
  const endErrorId = useId();

  const {
    startInput,
    endInput,
    fieldErrors,
    state,
    isSubmitting,
    changeStart,
    changeEnd,
    submit,
  } = useBookingForm({ resource, userId, onBooked });

  function handleStartChange(event: ChangeEvent<HTMLInputElement>): void {
    changeStart(event.target.value);
  }

  function handleEndChange(event: ChangeEvent<HTMLInputElement>): void {
    changeEnd(event.target.value);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void submit();
  }

  return (
    <section className={styles.section} aria-labelledby="booking-heading">
      <h2 id="booking-heading" className={styles.heading}>
        Book a resource
      </h2>

      <form className={styles.form} noValidate onSubmit={handleSubmit}>
        <div className={styles.selected} aria-live="polite">
          <span className={styles.label}>Selected resource</span>
          {resource === null ? (
            <p className={styles.placeholder}>
              None selected. Choose an available resource from the directory.
            </p>
          ) : (
            <p className={styles.resource}>
              <strong>{resource.name}</strong>
              <span className={styles.resourceMeta}>
                {RESOURCE_TYPE_LABELS[resource.type]} · {resource.location}
              </span>
            </p>
          )}
          {fieldErrors.resource !== undefined && (
            <p id={resourceErrorId} className={styles.fieldError}>
              {fieldErrors.resource}
            </p>
          )}
        </div>

        <fieldset className={styles.fieldset} disabled={isSubmitting}>
          <legend className={styles.legend}>
            Time window (your local time)
          </legend>
          <div className={styles.field}>
            <label htmlFor={startId} className={styles.label}>
              Start time
            </label>
            <input
              id={startId}
              type="datetime-local"
              className={styles.input}
              value={startInput}
              onChange={handleStartChange}
              aria-invalid={fieldErrors.start !== undefined}
              aria-describedby={
                fieldErrors.start !== undefined ? startErrorId : undefined
              }
            />
            {fieldErrors.start !== undefined && (
              <p id={startErrorId} className={styles.fieldError}>
                {fieldErrors.start}
              </p>
            )}
          </div>
          <div className={styles.field}>
            <label htmlFor={endId} className={styles.label}>
              End time
            </label>
            <input
              id={endId}
              type="datetime-local"
              className={styles.input}
              value={endInput}
              onChange={handleEndChange}
              aria-invalid={fieldErrors.end !== undefined}
              aria-describedby={
                fieldErrors.end !== undefined ? endErrorId : undefined
              }
            />
            {fieldErrors.end !== undefined && (
              <p id={endErrorId} className={styles.fieldError}>
                {fieldErrors.end}
              </p>
            )}
          </div>
        </fieldset>

        <p className={styles.hint}>
          Booking as <strong>{userId}</strong>. New reservations start as
          Pending. A resource marked available can still be reserved by someone
          else for your time window.
        </p>

        <button type="submit" className={styles.submit} disabled={isSubmitting}>
          {isSubmitting ? "Booking…" : "Book resource"}
        </button>

        {isSubmitting && (
          <StatusMessage kind="info">
            Submitting your reservation…
          </StatusMessage>
        )}
        {state.status === "success" && (
          <StatusMessage kind="success">
            Booked <strong>{state.resourceName}</strong> from{" "}
            {formatDateTime(state.reservation.startTime)} to{" "}
            {formatDateTime(state.reservation.endTime)}. Status:{" "}
            {RESERVATION_STATUS_LABELS[state.reservation.status]}.
          </StatusMessage>
        )}
        {state.status === "conflict" && (
          <StatusMessage kind="error">{state.message}</StatusMessage>
        )}
        {state.status === "error" && (
          <StatusMessage kind="error">
            Booking failed. {state.message}
          </StatusMessage>
        )}
      </form>
    </section>
  );
}

export default BookingForm;
