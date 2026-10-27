/**
 * The current student.
 *
 * CampusHub has no authentication: the backend accepts any non-empty string
 * as a reservation's `userId`. The id comes from VITE_CAMPUSHUB_USER_ID (e.g.
 * in client/.env.local) and falls back to a fixed demo student.
 */

const FALLBACK_USER_ID = "student-001";

function resolveCurrentUserId(): string {
  const configured: string | undefined = import.meta.env.VITE_CAMPUSHUB_USER_ID;
  if (configured === undefined || configured.trim() === "") {
    return FALLBACK_USER_ID;
  }
  return configured.trim();
}

export const CURRENT_USER_ID: string = resolveCurrentUserId();
