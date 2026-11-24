/**
 * Booking times for the E2E scenarios, computed in the browser's configured
 * time zone (E2E_TIME_ZONE) with built-in Intl only, so the host machine's
 * time zone never matters.
 */
import { E2E_LOCALE, E2E_TIME_ZONE } from "./e2e-env.ts";

export interface CalendarDay {
  year: number;
  month: number;
  day: number;
}

/** One wall-clock time in E2E_TIME_ZONE, in each form a test needs. */
export interface Slot {
  /** datetime-local value typed into the booking form. */
  input: string;
  /** The instant the app stores for `input`. */
  instant: Date;
  /** The text the app displays for `instant` (formatDateTime). */
  display: string;
}

const ZONE_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: E2E_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  hourCycle: "h23",
});

/** Same options as client/src/utils/datetime.ts, in the browser's settings. */
const DISPLAY_FORMAT = new Intl.DateTimeFormat(E2E_LOCALE, {
  timeZone: E2E_TIME_ZONE,
  dateStyle: "medium",
  timeStyle: "short",
});

const TIME_PATTERN = /^(\d{2}):(\d{2})$/;

/** The instant's wall-clock time in E2E_TIME_ZONE, read as if it were UTC. */
function wallClockAsUtc(instant: Date): number {
  const parts = new Map<string, number>(
    ZONE_PARTS.formatToParts(instant).map(
      (part: Intl.DateTimeFormatPart): [string, number] => [
        part.type,
        Number(part.value),
      ],
    ),
  );
  const get = (type: Intl.DateTimeFormatPartTypes): number =>
    parts.get(type) ?? Number.NaN;
  return Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
}

/** Tomorrow's date in E2E_TIME_ZONE. */
export function tomorrowInZone(now: Date = new Date()): CalendarDay {
  const today = new Date(wallClockAsUtc(now));
  const tomorrow = new Date(
    Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate() + 1,
    ),
  );
  return {
    year: tomorrow.getUTCFullYear(),
    month: tomorrow.getUTCMonth() + 1,
    day: tomorrow.getUTCDate(),
  };
}

/**
 * The wall-clock time `time` ("HH:mm") on `day` in E2E_TIME_ZONE. Times used
 * by the scenarios are never skipped or repeated by a DST change.
 */
export function zonedSlot(day: CalendarDay, time: string): Slot {
  const match = TIME_PATTERN.exec(time);
  if (match === null) {
    throw new Error(`Expected HH:mm, got "${time}"`);
  }
  const wall = Date.UTC(
    day.year,
    day.month - 1,
    day.day,
    Number(match[1]),
    Number(match[2]),
  );
  // Subtract the zone's UTC offset; recompute it once at the result in case
  // the first guess fell on the other side of an offset change.
  let instant = wall - (wallClockAsUtc(new Date(wall)) - wall);
  instant = wall - (wallClockAsUtc(new Date(instant)) - instant);

  const date = new Date(instant);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return {
    input: `${day.year}-${pad(day.month)}-${pad(day.day)}T${time}`,
    instant: date,
    display: DISPLAY_FORMAT.format(date),
  };
}

/**
 * A RegExp source matching `text` literally, except that any run of
 * whitespace matches any whitespace: engines differ on whether "10:00 AM"
 * uses a space or U+202F (narrow no-break space).
 */
export function flexibleSpaces(text: string): string {
  return text
    .trim()
    .split(/\s+/)
    .map((word: string): string => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");
}
