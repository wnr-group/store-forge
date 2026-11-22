import { DEFAULT_LAYOUT, DOCUMENT_SCHEMA_VERSION, LATEST_SCHEMA_VERSION, PAGE_KINDS, type TemplateDocument, type TemplateKind } from "../document";

/** One migration step: takes a document at version N and returns it at the shape of version N + 1. */
export type MigrationStep = (doc: Record<string, unknown>) => Record<string, unknown>;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const STYLE_KEY = "_style";
const STYLE_DEVICES = ["base", "tablet", "mobile"] as const;

/**
 * One node's `_style.hidden` per breakpoint as a device rule, preserving effective visibility with the same cascade the CSS has
 * (tablet falls back to base, mobile to tablet then base). Returns the node with the migrated `hidden` keys removed (empty
 * buckets and an empty `_style` are dropped, every other key is kept) and, when the node is hidden somewhere, a device rule.
 */
function migrateNode(node: Obj): Obj {
  const out: Obj = { ...node };
  if (isObj(node.blocks)) {
    out.blocks = Object.fromEntries(Object.entries(node.blocks).map(([id, child]) => [id, isObj(child) ? migrateNode(child) : child]));
  }
  const settings = node.settings;
  const style = isObj(settings) ? settings[STYLE_KEY] : undefined;
  if (!isObj(settings) || !isObj(style)) return out;

  const hiddenOf = (device: (typeof STYLE_DEVICES)[number]): boolean | undefined => {
    const bucket = style[device];
    return isObj(bucket) && typeof bucket.hidden === "boolean" ? bucket.hidden : undefined;
  };
  const base = hiddenOf("base");
  const tablet = hiddenOf("tablet");
  const mobile = hiddenOf("mobile");
  if (base === undefined && tablet === undefined && mobile === undefined) return out;

  const nextStyle: Obj = { ...style };
  for (const device of STYLE_DEVICES) {
    const bucket = style[device];
    if (!isObj(bucket) || typeof bucket.hidden !== "boolean") continue;
    const { hidden: _hidden, ...rest } = bucket;
    void _hidden;
    if (Object.keys(rest).length > 0) nextStyle[device] = rest;
    else delete nextStyle[device];
  }
  const nextSettings: Obj = { ...settings };
  if (Object.keys(nextStyle).length > 0) nextSettings[STYLE_KEY] = nextStyle;
  else delete nextSettings[STYLE_KEY];
  out.settings = nextSettings;

  const shown = {
    desktop: base !== true,
    tablet: (tablet ?? base) !== true,
    mobile: (mobile ?? tablet ?? base) !== true,
  };
  if (shown.desktop && shown.tablet && shown.mobile) return out;

  // A node that already carries a device rule keeps it: the two are ANDed, so a device is shown only if both allow it.
  const existing = isObj(node.display) && Array.isArray(node.display.rules) ? (node.display.rules as unknown[]) : [];
  const prior = existing.find((r): r is Obj => isObj(r) && r.type === "device");
  const device = {
    type: "device",
    desktop: shown.desktop && prior?.desktop !== false,
    tablet: shown.tablet && prior?.tablet !== false,
    mobile: shown.mobile && prior?.mobile !== false,
  };
  out.display = { v: 1, rules: [...existing.filter((r) => !(isObj(r) && r.type === "device")), device] };
  return out;
}

function migrateSections(sections: unknown): unknown {
  if (!isObj(sections)) return sections;
  return Object.fromEntries(Object.entries(sections).map(([id, node]) => [id, isObj(node) ? migrateNode(node) : node]));
}

/**
 * Step 1 -> 2: moves `_style.hidden` (per breakpoint) into a `display` device rule on every section and block, including the page
 * documents a theme document holds under `settings.pages`. Pure: never mutates its input. Everything else is left untouched.
 */
function migrateHiddenToDeviceRules(doc: Obj): Obj {
  const out: Obj = { ...doc, sections: migrateSections(doc.sections) };
  if (doc.sections === undefined) delete out.sections;
  const settings = doc.settings;
  const pages = isObj(settings) ? settings.pages : undefined;
  if (isObj(settings) && isObj(pages)) {
    const nextPages = Object.fromEntries(
      Object.entries(pages).map(([key, page]) => [key, isObj(page) && page.sections !== undefined ? { ...page, schemaVersion: 2, sections: migrateSections(page.sections) } : page]),
    );
    out.settings = { ...settings, pages: nextPages };
  }
  return out;
}

/**
 * Migration steps keyed by the version they migrate FROM. Step 1 -> 2 turns `_style.hidden` into display rules. It is NOT run on
 * read: `migrateDocument` leaves a schema 1 document at schema 1 (both are readable), and a document upgrades only when Studio
 * calls `upgradeToDisplayRules` before saving it.
 */
export const MIGRATION_STEPS: Readonly<Record<number, MigrationStep>> = Object.freeze({ 1: migrateHiddenToDeviceRules });

/** Lazy upgrade to schema 2 (display rules). A document already at schema 2 is returned as a clone. Never mutates `doc`. */
export function upgradeToDisplayRules(doc: Record<string, unknown>): Record<string, unknown> {
  const version = doc.schemaVersion;
  if (version === LATEST_SCHEMA_VERSION) return structuredClone(doc);
  if (version !== 1) throw new Error(`Cannot upgrade schemaVersion ${String(version)} to ${LATEST_SCHEMA_VERSION}`);
  return applyMigrationSteps(structuredClone(doc), 1, LATEST_SCHEMA_VERSION, MIGRATION_STEPS);
}

const isPageKind = (kind: TemplateKind): boolean => (PAGE_KINDS as readonly string[]).includes(kind);

/** Plain data only: an Object.prototype or null-prototype object. Arrays, Dates, Maps and class instances are not. */
const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== "object" || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

/**
 * Pure chain: runs `steps[from]`, `steps[from + 1]`, ... until the document is at `to`, stamping each new
 * schemaVersion. Never mutates `doc`; a missing step is an error rather than a silent skip.
 */
export function applyMigrationSteps(
  doc: Record<string, unknown>,
  from: number,
  to: number,
  steps: Readonly<Record<number, MigrationStep>>,
): Record<string, unknown> {
  let current = doc;
  for (let version = from; version < to; version++) {
    const step = Object.hasOwn(steps, version) ? steps[version] : undefined;
    if (!step) throw new Error(`No migration step from schemaVersion ${version} to ${version + 1}`);
    const next: unknown = step(current);
    if (!isPlainObject(next)) {
      throw new Error(`Migration step from schemaVersion ${version} to ${version + 1} must return an object`);
    }
    current = { ...next, schemaVersion: version + 1 };
  }
  return current;
}

/**
 * Migrate-on-read for template documents (D3, R3, AC-ENG-015): returns the document at the current
 * schemaVersion and never drops a key (theme `settings`, unknown extra keys and group documents without a
 * `layout` all survive). At schemaVersion 1 the content is the input unchanged, except that a page kind
 * (index, product, collection) with no `layout` gets `classic`; group and theme kinds never get one.
 *
 * The result is always a structured clone, so it never aliases the input and the input is never mutated
 * (it may be frozen). schemaVersion must be a positive integer no newer than DOCUMENT_SCHEMA_VERSION; the
 * database guarantees it (D6), so anything else is rejected rather than guessed at.
 */
export function migrateDocument(kind: TemplateKind, raw: unknown): TemplateDocument {
  if (!isPlainObject(raw)) {
    throw new Error("Invalid document: expected an object");
  }

  // An own property only: a version inherited from a prototype is not part of the stored document.
  const version = Object.hasOwn(raw, "schemaVersion") ? raw.schemaVersion : undefined;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1 || version > LATEST_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported schemaVersion: ${String(version)}. Newest supported version is ${LATEST_SCHEMA_VERSION}`,
    );
  }

  const migrated = applyMigrationSteps(structuredClone(raw), version, Math.min(version, DOCUMENT_SCHEMA_VERSION), MIGRATION_STEPS);
  // A page kind needs a layout, so an absent, null or empty one gets the default; any other string is the validator's call.
  if (isPageKind(kind) && (migrated.layout === undefined || migrated.layout === null || migrated.layout === "")) {
    migrated.layout = DEFAULT_LAYOUT;
  }
  return migrated as unknown as TemplateDocument;
}
