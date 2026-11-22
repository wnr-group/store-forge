/**
 * Trust badges: small store-owner statements (shipping, returns, packaging, quality) shown as a row of badges.
 * Pure data and functions. The badge kinds are closed: a preset from a fixed list, a short text with an icon from a fixed
 * icon list, or an uploaded mark. Nothing here, and nothing in the renderer, can state that Store Forge or anyone else has
 * verified, certified or secured anything: such wording is refused by `badgeExcludedClaim`, which the server readiness rule mirrors.
 */
import { safeUrl } from "./engine/schema";

export const BADGE_KINDS = Object.freeze(["preset", "text", "upload"] as const);
export type BadgeKind = (typeof BADGE_KINDS)[number];

/** Closed preset list. No verified, trusted, certified, secure-payment or payment-provider presets, ever. */
export const PRESET_BADGES = Object.freeze(["free-shipping", "easy-returns", "secure-packaging", "quality-checked"] as const);
export type PresetBadge = (typeof PRESET_BADGES)[number];

/** Closed icon list (lucide icon names). No shield, lock, badge-check or other icon that implies certification or security. */
export const BADGE_ICONS = Object.freeze([
  "truck",
  "rotate-ccw",
  "package",
  "gift",
  "heart",
  "leaf",
  "star",
  "clock",
  "thumbs-up",
  "sparkles",
  "map-pin",
  "headphones",
] as const);
export type BadgeIcon = (typeof BADGE_ICONS)[number];

export const BADGE_LIMITS = Object.freeze({ text: 40, alt: 125, assetId: 64, path: 300 });

/** The line shown next to every trust badges section. Catalogue key `trustBadges.disclaimer`. */
export const BADGE_DISCLAIMER_KEY = "trustBadges.disclaimer";

const PRESET_KEY: Record<PresetBadge, "trustBadges.preset.freeShipping" | "trustBadges.preset.easyReturns" | "trustBadges.preset.securePackaging" | "trustBadges.preset.qualityChecked"> = {
  "free-shipping": "trustBadges.preset.freeShipping",
  "easy-returns": "trustBadges.preset.easyReturns",
  "secure-packaging": "trustBadges.preset.securePackaging",
  "quality-checked": "trustBadges.preset.qualityChecked",
};
export const presetMessageKey = (p: PresetBadge) => PRESET_KEY[p];

const isIn = <T extends string>(list: readonly T[], v: unknown): v is T => typeof v === "string" && (list as readonly string[]).includes(v);
export const isPresetBadge = (v: unknown): v is PresetBadge => isIn(PRESET_BADGES, v);
export const isBadgeIcon = (v: unknown): v is BadgeIcon => isIn(BADGE_ICONS, v);

/** Payment providers and networks whose names must not appear in a badge (a badge would imply a relationship or endorsement). */
const PROVIDERS = [
  "visa",
  "mastercard",
  "maestro",
  "rupay",
  "amex",
  "american express",
  "upi",
  "razorpay",
  "paytm",
  "phonepe",
  "gpay",
  "google pay",
  "apple pay",
  "paypal",
  "stripe",
  "cashfree",
  "payu",
  "ccavenue",
  "bhim",
];

const CLAIM_PATTERNS: readonly { term: string; re: RegExp }[] = [
  { term: "verified seller", re: /\bverified\s+(seller|store|shop|merchant|business|vendor)s?\b/ },
  { term: "trusted store", re: /\btrusted\s+(store|seller|shop|merchant|business|vendor|site|website)s?\b/ },
  { term: "secure checkout", re: /\bsecure\s+(checkout|payments?|transactions?)\b/ },
  { term: "certified", re: /\bcertifi(ed|cation|cate)\b/ },
  ...PROVIDERS.map((p) => ({ term: p, re: new RegExp(`\\b${p.replace(/\s+/g, "\\s+")}\\b`) })),
];

/** Lower case, compatibility-folded, with dashes, underscores and invisible characters turned into plain spaces, so "Secure-Checkout" and text with hidden characters inside a word are still found. */
const INVISIBLE = new RegExp("[" + ["200B-200D","2060","FEFF","00AD"].map((r) => r.split("-").map((h) => String.fromCharCode(parseInt(h, 16))).join("-")).join("") + "]", "g");
const DASHES = new RegExp("[-_" + String.fromCharCode(0x2010) + "-" + String.fromCharCode(0x2015) + "]+", "g");

function fold(text: string): string {
  return text.normalize("NFKC").replace(INVISIBLE, "").toLowerCase().replace(DASHES, " ").replace(/\s+/g, " ");
}

/**
 * The excluded claim `text` makes (verified seller, trusted store, secure checkout or payment, certified, or a payment provider
 * name such as visa, mastercard, upi, razorpay), or null when it makes none. Case-insensitive.
 */
export function badgeExcludedClaim(text: unknown): string | null {
  if (typeof text !== "string") return null;
  const folded = fold(text);
  for (const { term, re } of CLAIM_PATTERNS) if (re.test(folded)) return term;
  return null;
}

/** A badge link is an internal path ("/returns") or an https address. Anything else (javascript:, data:, http: to another site, mailto, protocol-relative) is refused. */
export function safeBadgeLink(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v) return null;
  if (v.startsWith("#")) return null;
  if (v.startsWith("/")) return safeUrl(v);
  if (!/^https:\/\//i.test(v)) return null;
  return safeUrl(v);
}

export type BadgeSettings = {
  kind: BadgeKind;
  preset: string;
  text: string;
  icon: string;
  markAssetId: string;
  markPath: string;
  markAlt: string;
  link: string;
};

const str = (v: unknown): string => (typeof v === "string" ? v : "");

export function readBadgeSettings(settings: Record<string, unknown> | undefined): BadgeSettings {
  const s = settings ?? {};
  return {
    kind: isIn(BADGE_KINDS, s.kind) ? s.kind : "preset",
    preset: str(s.preset),
    text: str(s.text).trim(),
    icon: str(s.icon),
    markAssetId: str(s.markAssetId).trim(),
    markPath: str(s.markPath).trim(),
    markAlt: str(s.markAlt).trim(),
    link: str(s.link).trim(),
  };
}

const CLAIM_MESSAGE = "Badges cannot say a store is verified, trusted, certified or secure, or name a payment provider.";

/** Problems of one trust badge's settings, by setting id. Empty when the badge is fine. */
export function validateBadgeSettings(settings: Record<string, unknown> | undefined): Record<string, string> {
  const raw = settings ?? {};
  const b = readBadgeSettings(settings);
  const out: Record<string, string> = {};
  if (raw.kind !== undefined && !isIn(BADGE_KINDS, raw.kind)) out.kind = "Choose a badge type from the list.";
  if (b.kind === "preset") {
    if (!isPresetBadge(b.preset)) out.preset = "Choose a badge from the list.";
    else if (badgeExcludedClaim(b.preset.replace(/-/g, " "))) out.preset = CLAIM_MESSAGE;
  } else if (b.kind === "text") {
    if (!b.text) out.text = "Write the badge text.";
    else if (b.text.length > BADGE_LIMITS.text) out.text = `Use at most ${BADGE_LIMITS.text} characters.`;
    else if (badgeExcludedClaim(b.text)) out.text = CLAIM_MESSAGE;
    if (!isBadgeIcon(b.icon)) out.icon = "Choose an icon from the list.";
  } else {
    if (!b.markAssetId || b.markAssetId.length > BADGE_LIMITS.assetId) out.markAssetId = "Upload an image for this badge.";
    if (!b.markPath || b.markPath.length > BADGE_LIMITS.path) out.markPath = "Upload an image for this badge.";
    if (!b.markAlt) out.markAlt = "Describe the image for people who cannot see it.";
    else if (b.markAlt.length > BADGE_LIMITS.alt) out.markAlt = `Use at most ${BADGE_LIMITS.alt} characters.`;
    else if (badgeExcludedClaim(b.markAlt)) out.markAlt = CLAIM_MESSAGE;
  }
  if (b.link && safeBadgeLink(b.link) === null) out.link = "Use a page on your store (starting with /) or an https:// address.";
  return out;
}
