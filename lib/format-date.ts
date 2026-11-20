/**
 * Dates shown in the merchant dashboard, in the store's configured timezone (Settings > Regional) instead of whatever
 * timezone the server or the browser happens to run in. Passing the zone explicitly also keeps server and client
 * renders identical, so a client component never hydrates with a different day than the server printed.
 */
const LOCALE = "en-IN";

const DATE: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
const DATE_TIME: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" };

const cache = new Map<string, Intl.DateTimeFormat>();

function formatter(kind: "date" | "dateTime", timezone: string): Intl.DateTimeFormat {
  const key = `${kind}|${timezone}`;
  let fmt = cache.get(key);
  if (!fmt) {
    const options = kind === "date" ? DATE : DATE_TIME;
    try {
      fmt = new Intl.DateTimeFormat(LOCALE, { ...options, timeZone: timezone });
    } catch {
      // Not a zone this runtime knows: show UTC rather than throw while rendering a page.
      fmt = new Intl.DateTimeFormat(LOCALE, { ...options, timeZone: "UTC" });
    }
    cache.set(key, fmt);
  }
  return fmt;
}

/** "6 Nov 2026" in `timezone`. */
export const formatDate = (date: Date, timezone: string): string => formatter("date", timezone).format(date);

/** "6 Nov, 12:30 am" in `timezone`. */
export const formatDateTime = (date: Date, timezone: string): string => formatter("dateTime", timezone).format(date);
