/**
 * Booking form logic: the entered time window, client-side validation,
 * conversion of datetime-local values to ISO-8601 instants, request
 * construction, and submission. The API call and its request state come
 * from useCreateReservation; this hook only coordinates them.
 */
import { useState } from "react";

import type {
  CreateReservationRequest,
  Reservation,
  Resource,
} from "../../../shared/api.d.ts";
import { parseLocalDateTime } from "../utils/datetime.ts";
import {
  useCreateReservation,
  type CreateReservationState,
} from "./useCreateReservation.ts";

/** Per-field validation messages; a missing key means the field is valid. */
export interface BookingFieldErrors {
  resource?: string;
  start?: string;
  end?: string;
}

export interface UseBookingFormOptions {
  /** The resource chosen in the directory, or null if none is selected. */
  resource: Resource | null;
  /** Sent as the reservation's userId. */
  userId: string;
  /** Called once a reservation has been created. */
  onBooked: (reservation: Reservation) => void;
}

export interface UseBookingFormResult {
  /** Raw datetime-local input values (local wall-clock time). */
  startInput: string;
  endInput: string;
  fieldErrors: BookingFieldErrors;
  /** Request state from useCreateReservation. */
  state: CreateReservationState;
  isSubmitting: boolean;
  /** Update an input and clear outdated feedback. */
  changeStart: (value: string) => void;
  changeEnd: (value: string) => void;
  /** Validate and, if valid, create the reservation. */
  submit: () => Promise<void>;
}

type ValidationResult =
  | { ok: true; resource: Resource; startTime: string; endTime: string }
  | { ok: false; errors: BookingFieldErrors };

function validate(
  resource: Resource | null,
  startInput: string,
  endInput: string,
): ValidationResult {
  const errors: BookingFieldErrors = {};
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

export function useBookingForm({
  resource,
  userId,
  onBooked,
}: UseBookingFormOptions): UseBookingFormResult {
  const [startInput, setStartInput] = useState<string>("");
  const [endInput, setEndInput] = useState<string>("");
  const [fieldErrors, setFieldErrors] = useState<BookingFieldErrors>({});
  const { state, submit: createReservation, reset } = useCreateReservation();

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

  function changeStart(value: string): void {
    setStartInput(value);
    clearFeedback();
  }

  function changeEnd(value: string): void {
    setEndInput(value);
    clearFeedback();
  }

  async function submit(): Promise<void> {
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
    const payload: CreateReservationRequest = {
      resourceId: result.resource.id,
      userId,
      startTime: result.startTime,
      endTime: result.endTime,
    };
    const created = await createReservation(payload, result.resource.name);
    if (created !== null) {
      onBooked(created);
    }
  }

  return {
    startInput,
    endInput,
    fieldErrors,
    state,
    isSubmitting,
    changeStart,
    changeEnd,
    submit,
  };
}
