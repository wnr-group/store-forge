/**
 * Central English message catalogue. Keys are stable dotted identifiers (`area.topic.detail`) that other layers
 * (manifests, readiness issues, the API) may reference; the English text may change, a key never is reused for another meaning.
 * Plain data and pure functions: no React, no Intl state, safe in the browser and on the server.
 * Placeholders are written `{name}`; a missing parameter leaves the placeholder visible rather than printing "undefined".
 */
export const DEFAULT_LOCALE = "en";

export const MESSAGES = {
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.publish": "Publish",
  "common.discard": "Discard",
  "common.loading": "Loading",
  "common.retry": "Try again",
  "common.error.generic": "Something went wrong. Please try again.",
  "common.error.forbidden": "You do not have permission to do that.",
  "common.count.items": "{count} items",

  "readiness.component.unavailable": "{name} is not available yet and cannot be published.",
  "readiness.component.unavailable.legal": "{name} needs an approval before it can be published.",
  "readiness.component.unavailable.purchaseFlow": "{name} needs the purchase flow to be live.",
  "readiness.component.deprecated": "{name} is deprecated and will be removed.",

  "display.schedule.label": "Show on a schedule",
  "display.schedule.upcoming": "Scheduled to show from {startsAt}",
  "display.schedule.active": "Showing until {endsAt}",
  "display.schedule.expired": "Ended on {endsAt}",
  "display.schedule.invalidRange": "The end must be after the start.",
  "display.schedule.timezone": "Times use the {timezone} time zone.",
  "display.device.label": "Show on devices",
  "display.device.desktop": "Desktop",
  "display.device.tablet": "Tablet",
  "display.device.mobile": "Mobile",
  "display.device.noneVisible": "This is hidden on every device.",
  "display.panel.title": "When to show",
  "display.panel.help": "Choose the dates this appears on your store, and the devices it appears on.",
  "display.schedule.start": "Start",
  "display.schedule.end": "End",
  "display.schedule.clear": "Clear",
  "display.timezone.label": "Time zone",
  "display.timezone.fallback": "store timezone",
  "display.state.always": "Always",
  "display.state.upcoming": "Upcoming",
  "display.state.active": "Active",
  "display.state.expired": "Expired",
  "display.device.footnote": "Hiding on a device is a visual setting. Content may still be sent to the browser.",
  "display.error.invalid": "Enter a valid date and time.",
  "display.error.nonexistentTime": "That time does not exist on the store clock (clocks change that night). Pick another time.",
  "display.badge.scheduled": "Scheduled",
  "display.badge.upcoming": "Upcoming",
  "display.badge.expired": "Expired",
  "display.badge.hiddenOn": "Hidden on {devices}",
  "display.preview.label": "Preview as of...",
  "display.preview.reset": "Show now",
  "display.preview.help": "Shows the page as it will look at that date and time in the store time zone. Only the editor preview changes; your live store always uses the real time.",

  "countdown.announce.long": "This offer ends in more than one day.",
  "countdown.announce.day": "This offer ends in less than one day.",
  "countdown.announce.hour": "This offer ends in less than one hour.",
  "countdown.announce.tenMinutes": "This offer ends in less than ten minutes.",
  "countdown.announce.minute": "This offer ends in less than one minute.",
  "countdown.announce.ended": "This offer has ended.",
  "countdown.unit.days": "days",
  "countdown.unit.hours": "hours",
  "countdown.unit.minutes": "minutes",
  "countdown.unit.seconds": "seconds",
  "countdown.editor.noTarget": "Set an end time under When to show, or choose a fixed date, so this countdown has something to count to. Visitors do not see it until then.",
  "countdown.editor.unavailable": "Countdown is not available for your store yet.",

  "trustBadges.disclaimer": "Badge claims are statements by the store owner. Store Forge does not verify them.",
  "trustBadges.preset.freeShipping": "Free shipping",
  "trustBadges.preset.easyReturns": "Easy returns",
  "trustBadges.preset.securePackaging": "Secure packaging",
  "trustBadges.preset.qualityChecked": "Quality checked",
  "trustBadges.upload.title": "Upload a badge image",
  "trustBadges.upload.attestIntro": "Before this image can be used, please read and confirm the statement below.",
  "trustBadges.upload.confirm": "I confirm",
  "trustBadges.upload.unavailable": "Uploading your own badge image is not available for your store yet.",
  "trustBadges.upload.needsAttest": "You need permission to attest before you can upload a badge image.",

  "component.unavailable.reason": "Not available for your store yet.",
  "component.unavailable.reason.legal": "Needs an approval before it can be used.",
  "component.unavailable.reason.manifest": "Not available.",
  "component.unavailable.reason.deprecated": "Deprecated.",
  "component.unavailable.reason.purchaseFlow": "Needs the purchase flow to be live.",

  "manifest.error.invalid": "Invalid component manifest. Fields: {fields}",

  "attestation.required": "Your confirmation is required before this can be published.",
  "legal.gate.pending": "This feature is waiting for approval.",

  "studio.draft.saved": "Draft saved",
  "studio.publish.success": "Published {when}",
  "studio.publish.blocked": "{count} problems must be fixed before publishing.",
} as const;

export type MessageKey = keyof typeof MESSAGES;
export type MessageParams = Record<string, string | number | boolean | null | undefined>;

export function isMessageKey(key: string): key is MessageKey {
  return Object.hasOwn(MESSAGES, key);
}

/** The English text for `key` with `{placeholders}` filled from `params`. An unknown key returns the key itself (visible, never empty). */
export function t(key: MessageKey | (string & {}), params?: MessageParams): string {
  const template = isMessageKey(key) ? MESSAGES[key] : key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    if (!Object.hasOwn(params, name)) return whole;
    const value = params[name];
    return value === undefined || value === null ? whole : String(value);
  });
}

/**
 * Translate with a locale. Only English exists today, so every locale resolves to the English catalogue (the fallback); the
 * locale argument is the seam where other catalogues will be looked up first.
 */
export function tLocale(_locale: string, key: MessageKey | (string & {}), params?: MessageParams): string {
  return t(key, params);
}

// ---- locale-aware formatting ------------------------------------------------------------------------------------

export function isValidTimeZone(timeZone: unknown): timeZone is string {
  if (typeof timeZone !== "string" || timeZone.length === 0 || timeZone.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone });
    return true;
  } catch {
    return false;
  }
}

function safeLocale(locale: string | undefined): string {
  if (!locale) return DEFAULT_LOCALE;
  try {
    return Intl.getCanonicalLocales(locale)[0] ?? DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

function toDate(value: Date | string | number): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new RangeError("Invalid date");
  return date;
}

export type DateStyle = "date" | "time" | "dateTime";

/**
 * Format an absolute instant in an IANA time zone (for example "Asia/Kolkata"). The time zone is required: a date shown without
 * one silently depends on the server or browser zone. An invalid zone or instant throws a RangeError.
 */
export function formatDateTime(value: Date | string | number, opts: { timeZone: string; locale?: string; style?: DateStyle }): string {
  if (!isValidTimeZone(opts.timeZone)) throw new RangeError("Invalid time zone");
  const style = opts.style ?? "dateTime";
  const format: Intl.DateTimeFormatOptions = {
    timeZone: opts.timeZone,
    ...(style !== "time" ? { year: "numeric", month: "short", day: "numeric" } : {}),
    ...(style !== "date" ? { hour: "numeric", minute: "2-digit" } : {}),
  };
  return new Intl.DateTimeFormat(safeLocale(opts.locale), format).format(toDate(value));
}

/** Format an amount of money. `currency` is an ISO 4217 code; an invalid code throws a RangeError. */
export function formatCurrency(amount: number, currency: string, opts: { locale?: string } = {}): string {
  if (!Number.isFinite(amount)) throw new RangeError("Invalid amount");
  return new Intl.NumberFormat(safeLocale(opts.locale), { style: "currency", currency }).format(amount);
}
