import { Temporal } from "@js-temporal/polyfill";

/**
 * Parses an SQLite/UTC timestamp string (e.g. "2026-08-22 20:30:03 UTC" or "2026-08-22 20:30:03")
 * into a Temporal.Instant.
 */
export function parseUtcDate(dateStr: string): Temporal.Instant {
  const isoString = dateStr
    .trim()
    .replace(" UTC", "")
    .replace(" ", "T")
    .concat("Z");

  return Temporal.Instant.from(isoString);
}

export function formatArticleDate(
  dateStr: string,
  timeZone: string = "America/Los_Angeles"
): {
  longDate: string;
  shortDate: string;
  relativeTime: string;
} {
  const instant = parseUtcDate(dateStr);
  const zonedDateTime = instant.toZonedDateTimeISO(timeZone);

  // 1. Long readable format (e.g., "August 22, 2026 at 1:30 PM PDT")
  const longDate = zonedDateTime.toLocaleString("en-US", {
    dateStyle: "long",
    timeStyle: "short",
  });

  // 2. Short date format (e.g., "Aug 22, 2026")
  const shortDate = zonedDateTime.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  // 3. Relative difference using ZonedDateTime (supports 'day', 'month', 'year')
  const nowZoned = Temporal.Now.zonedDateTimeISO(timeZone);
  const duration = zonedDateTime.since(nowZoned, {
    largestUnit: "day",
    smallestUnit: "minute",
    roundingMode: "halfExpand",
  });

  const rtf = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });
  let relativeTime = "";

  if (Math.abs(duration.days) >= 1) {
    relativeTime = rtf.format(duration.days, "day");
  } else if (Math.abs(duration.hours) >= 1) {
    relativeTime = rtf.format(duration.hours, "hour");
  } else {
    relativeTime = rtf.format(duration.minutes, "minute");
  }

  return { longDate, shortDate, relativeTime };
}
