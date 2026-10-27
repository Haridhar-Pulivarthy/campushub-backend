/**
 * Booking form for the selected resource. Validates the time window, sends
 * local datetime-local values to the API as ISO-8601 instants, and reports
 * success, conflicts (409), and other errors.
 */
import { useId, useState } from "react";
import type { ChangeEvent, FormEvent, ReactElement } from "react";

import { useCreateReservation } from "../hooks/useCreateReservation.ts";
import type {
  CreateReservationDTO,
  Reservation,
  Resource,
} from "../types/api.ts";
import { formatDateTime, parseLocalDateTime } from "../utils/datetime.ts";
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

interface FieldErrors {
  resource?: string;
  start?: string;
  end?: string;
}

type ValidationResult =
  | { ok: true; resource: Resource; startTime: string; endTime: string }
  | { ok: false; errors: FieldErrors };

function validate(
  resource: Resource | null,
  startInput: string,
  endInput: string,
): ValidationResult {
  const errors: FieldErrors = {};
  if (resource === null) {
    errors.resource = "Select an available resource from the directory.";
  } else if (!resource.isAvailable) {
    errors.resource = "This resource is unavailable and cannot be booked.";
  }

  const start = parseLocalDateTime(startInput);
  const end = parseLocalDateTime(endInput);
  if (start === null) {
    errors.start = "Enter a valid start date and time.";
  }
  if (end === null) {
    errors.end = "Enter a valid end date and time.";
  }
  if (start !== null && end !== null && start.getTime() >= end.getTime()) {
    errors.end = "End time must be after the start time.";
  }

  if (
    resource === null ||
    start === null ||
    end === null ||
    Object.keys(errors).length > 0
  ) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    resource,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
  };
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

  const [startInput, setStartInput] = useState<string>("");
  const [endInput, setEndInput] = useState<string>("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const { state, submit, reset } = useCreateReservation();

  // Selecting a different resource makes earlier feedback outdated. The
  // entered times are kept so the student can try another resource for the
  // same window (e.g. after a conflict). Adjusting state during render, per
  // React's "storing information from previous renders" pattern.
  const resourceId = resource?.id ?? null;
  const [feedbackResourceId, setFeedbackResourceId] = useState<string | null>(
    resourceId,
  );
  if (feedbackResourceId !== resourceId) {
    setFeedbackResourceId(resourceId);
    setFieldErrors({});
    reset();
  }

  const isSubmitting = state.status === "submitting";

  function clearFeedback(): void {
    setFieldErrors({});
    reset();
  }

  function handleStartChange(event: ChangeEvent<HTMLInputElement>): void {
    setStartInput(event.target.value);
    clearFeedback();
  }

  function handleEndChange(event: ChangeEvent<HTMLInputElement>): void {
    setEndInput(event.target.value);
    clearFeedback();
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }
    const result = validate(resource, startInput, endInput);
    if (!result.ok) {
      reset();
      setFieldErrors(result.errors);
      return;
    }
    setFieldErrors({});

    // status is omitted so the backend applies its default (PENDING).
    const payload: CreateReservationDTO = {
      resourceId: result.resource.id,
      userId,
      startTime: result.startTime,
      endTime: result.endTime,
    };
    const created = await submit(payload, result.resource.name);
    if (created !== null) {
      onBooked(created);
    }
  }

  return (
    <section className={styles.section} aria-labelledby="booking-heading">
      <h2 id="booking-heading" className={styles.heading}>
        Book a resource
      </h2>

      <form
        className={styles.form}
        noValidate
        onSubmit={(event: FormEvent<HTMLFormElement>): void => {
          void handleSubmit(event);
        }}
      >
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
