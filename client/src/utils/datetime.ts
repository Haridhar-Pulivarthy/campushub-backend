/**
 * Date-time helpers for converting between `<input type="datetime-local">`
 * values (local wall-clock time, no offset) and the API's ISO-8601 strings.
 */

/** `YYYY-MM-DDTHH:mm`, optionally with `:ss` and fractional seconds. */
const LOCAL_DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/;

const DATE_TIME_FORMAT = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function toInt(part: string | undefined): number {
  return part === undefined ? 0 : Number.parseInt(part, 10);
}

/**
 * Parse a datetime-local value as a time in the browser's local time zone.
 * @returns the instant, or null when the value is empty or not a real date.
 */
export function parseLocalDateTime(value: string): Date | null {
  const match = LOCAL_DATE_TIME_PATTERN.exec(value);
  if (match === null) {
    return null;
  }
  const year = toInt(match[1]);
  const month = toInt(match[2]);
  const day = toInt(match[3]);
  const hour = toInt(match[4]);
  const minute = toInt(match[5]);
  const second = toInt(match[6]);
  if (hour > 23 || minute > 59 || second > 59) {
    return null;
  }

  // The multi-argument Date constructor interprets its fields as local time.
  const date = new Date(year, month - 1, day, hour, minute, second);

  // Reject dates that rolled over (e.g. Feb 30 -> Mar 2).
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

/** Format an ISO-8601 instant in the user's locale and time zone. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : DATE_TIME_FORMAT.format(date);
}
