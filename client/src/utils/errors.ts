/**
 * User-facing error messages for failed API calls.
 */
import { ApiError } from "../api/campushubApi.ts";

/**
 * Message to show for an error thrown by the API layer. Client errors (4xx)
 * and network failures carry a useful message; server errors do not expose
 * details, so they get a generic one.
 */
export function getErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status >= 500) {
      return "The CampusHub server ran into a problem. Please try again.";
    }
    return err.message;
  }
  return "Something went wrong. Please try again.";
}
