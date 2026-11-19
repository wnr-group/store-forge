import { z } from "zod";
import { FONT_KEYS, FONT_REGISTRY, FONT_TRANSFORMS, TYPOGRAPHY_BOUNDS, type FontKey } from "@/lib/templates/engine/fonts";
import { hexColorSchema } from "@/lib/templates/engine/schema";

/**
 * Element style overrides: the one place that says which visual properties a merchant can change on an element, how each
 * control looks, what values are valid and how a value becomes CSS. Theme independent: no React, no theme names.
 *
 * Stored on a section or block as `settings._style`:
 *   { base: { color: "#fff" }, tablet: { fontSize: 20 }, mobile: { hidden: true } }
 * `tablet` applies to tablets and smaller, `mobile` to phones only (same fallback as `resolveResponsiveValue`).
 * The field table below generates the validation schema, the editor controls and the CSS, so the three cannot drift.
 * Nothing the merchant types ever reaches CSS as text: numbers are clamped, colours are #rrggbb, everything else is an enum.
 */

export const STYLE_SETTING_KEY = "_style";

export const CAPABILITY_IDS = ["fonts", "typography", "textColor", "background", "spacing", "size", "border", "opacity", "visibility"] as const;
export type CapabilityId = (typeof CAPABILITY_IDS)[number];

export const CAPABILITY_LABELS: Record<CapabilityId, string> = {
  fonts: "Fonts for this section",
  typography: "Typography",
  textColor: "Text colour",
  background: "Background",
  spacing: "Spacing",
  size: "Size",
  border: "Border and corners",
  opacity: "Opacity",
  visibility: "Visibility",
};

export const DEVICES = ["base", "tablet", "mobile"] as const;
export type StyleDevice = (typeof DEVICES)[number];

type Option = { label: string; value: string | number };
export type Control =
  | { type: "select"; options: Option[] }
  | { type: "segmented"; options: Option[] }
  | { type: "range"; min: number; max: number; step: number; unit?: string }
  | { type: "color" }
  | { type: "toggle" };

export type StyleField = { key: StyleKey; label: string; capability: CapabilityId; control: Control; help?: string };

const FONT_WEIGHTS: Option[] = [
  { label: "Light", value: 300 },
  { label: "Regular", value: 400 },
  { label: "Medium", value: 500 },
  { label: "Semibold", value: 600 },
  { label: "Bold", value: 700 },
  { label: "Extra bold", value: 800 },
  { label: "Black", value: 900 },
];

const px = (min: number, max: number, step = 1) => ({ type: "range", min, max, step, unit: "px" }) as const;

const FONT_OPTIONS: Option[] = FONT_KEYS.map((k) => ({ label: FONT_REGISTRY[k].name, value: k }));

export const STYLE_FIELDS = [
  { key: "headingFont", label: "Heading font", capability: "fonts", control: { type: "select", options: FONT_OPTIONS } },
  { key: "bodyFont", label: "Body font", capability: "fonts", control: { type: "select", options: FONT_OPTIONS } },
  { key: "fontFamily", label: "Font", capability: "typography", control: { type: "select", options: FONT_KEYS.map((k) => ({ label: FONT_REGISTRY[k].name, value: k })) } },
  { key: "fontSize", label: "Size", capability: "typography", control: px(TYPOGRAPHY_BOUNDS.minSize, TYPOGRAPHY_BOUNDS.maxSize) },
  { key: "fontWeight", label: "Weight", capability: "typography", control: { type: "select", options: FONT_WEIGHTS } },
  { key: "fontStyle", label: "Style", capability: "typography", control: { type: "segmented", options: [{ label: "Normal", value: "normal" }, { label: "Italic", value: "italic" }] } },
  { key: "textAlign", label: "Alignment", capability: "typography", control: { type: "segmented", options: [{ label: "Left", value: "left" }, { label: "Centre", value: "center" }, { label: "Right", value: "right" }] } },
  { key: "lineHeight", label: "Line height", capability: "typography", control: { type: "range", min: TYPOGRAPHY_BOUNDS.minLineHeight, max: TYPOGRAPHY_BOUNDS.maxLineHeight, step: 0.1 } },
  { key: "letterSpacing", label: "Letter spacing", capability: "typography", control: px(TYPOGRAPHY_BOUNDS.minLetterSpacing, TYPOGRAPHY_BOUNDS.maxLetterSpacing, 0.5) },
  { key: "textTransform", label: "Capitalisation", capability: "typography", control: { type: "select", options: FONT_TRANSFORMS.map((v) => ({ label: v === "none" ? "As typed" : v[0].toUpperCase() + v.slice(1), value: v })) } },
  { key: "textDecoration", label: "Decoration", capability: "typography", control: { type: "segmented", options: [{ label: "None", value: "none" }, { label: "Underline", value: "underline" }, { label: "Strike", value: "line-through" }] } },
  { key: "color", label: "Text colour", capability: "textColor", control: { type: "color" } },
  { key: "backgroundColor", label: "Background colour", capability: "background", control: { type: "color" } },
  { key: "paddingTop", label: "Padding top", capability: "spacing", control: px(0, 400) },
  { key: "paddingBottom", label: "Padding bottom", capability: "spacing", control: px(0, 400) },
  { key: "paddingLeft", label: "Padding left", capability: "spacing", control: px(0, 400) },
  { key: "paddingRight", label: "Padding right", capability: "spacing", control: px(0, 400) },
  { key: "marginTop", label: "Space above", capability: "spacing", control: px(0, 400) },
  { key: "marginBottom", label: "Space below", capability: "spacing", control: px(0, 400) },
  { key: "maxWidth", label: "Maximum width", capability: "size", control: px(120, 1920, 10) },
  { key: "minHeight", label: "Minimum height", capability: "size", control: px(0, 1200, 10) },
  { key: "borderRadius", label: "Corner radius", capability: "border", control: px(0, 100) },
  { key: "borderWidth", label: "Border width", capability: "border", control: px(0, 20) },
  { key: "borderColor", label: "Border colour", capability: "border", control: { type: "color" } },
  { key: "opacity", label: "Opacity", capability: "opacity", control: { type: "range", min: 0, max: 100, step: 5, unit: "%" } },
  { key: "hidden", label: "Hide on this device", capability: "visibility", control: { type: "toggle" } },
] as const satisfies readonly { key: string; label: string; capability: CapabilityId; control: Control; help?: string }[];

export type StyleKey = (typeof STYLE_FIELDS)[number]["key"];
export const STYLE_KEYS = STYLE_FIELDS.map((f) => f.key) as StyleKey[];

export type StyleValues = {
  headingFont?: FontKey;
  bodyFont?: FontKey;
  fontFamily?: FontKey;
  fontSize?: number;
  fontWeight?: number;
  fontStyle?: "normal" | "italic";
  textAlign?: "left" | "center" | "right";
  lineHeight?: number;
  letterSpacing?: number;
  textTransform?: (typeof FONT_TRANSFORMS)[number];
  textDecoration?: "none" | "underline" | "line-through";
  color?: string;
  backgroundColor?: string;
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;
  marginTop?: number;
  marginBottom?: number;
  maxWidth?: number;
  minHeight?: number;
  borderRadius?: number;
  borderWidth?: number;
  borderColor?: string;
  opacity?: number;
  hidden?: boolean;
};
export type ElementStyle = Partial<Record<StyleDevice, StyleValues>>;

export const fieldsFor = (capabilities: readonly CapabilityId[]): StyleField[] => STYLE_FIELDS.filter((f) => capabilities.includes(f.capability)) as StyleField[];

function fieldSchema(field: StyleField): z.ZodTypeAny {
  const c = field.control;
  switch (c.type) {
    case "color":
      return hexColorSchema;
    case "toggle":
      return z.boolean();
    case "range":
      return z.number().finite().min(c.min).max(c.max);
    case "select":
    case "segmented": {
      const values = c.options.map((o) => o.value);
      return z.union([z.string(), z.number()]).refine((v) => values.includes(v), "Not an allowed value");
    }
  }
}

const valuesSchema = z.object(Object.fromEntries((STYLE_FIELDS as readonly StyleField[]).map((f) => [f.key, fieldSchema(f).optional()]))).strict();

/** Strict: an unknown property or device is an error, never silently kept. */
export const elementStyleSchema = z.object({ base: valuesSchema.optional(), tablet: valuesSchema.optional(), mobile: valuesSchema.optional() }).strict();

export function parseElementStyle(input: unknown): ElementStyle | null {
  const r = elementStyleSchema.safeParse(input);
  return r.success ? (r.data as ElementStyle) : null;
}

// ---- reading and writing ------------------------------------------------------------------------------------------

export function readStyle(settings: Record<string, unknown> | undefined): ElementStyle {
  const raw = settings?.[STYLE_SETTING_KEY];
  return raw && typeof raw === "object" ? (raw as ElementStyle) : {};
}

/** Returns a new style with one property set (or removed when `value` is undefined); empty buckets are dropped. */
export function withStyleValue(style: ElementStyle, device: StyleDevice, key: StyleKey, value: unknown): ElementStyle {
  const bucket: Record<string, unknown> = { ...(style[device] ?? {}) };
  if (value === undefined || value === null || value === "") delete bucket[key];
  else bucket[key] = value;
  const next: ElementStyle = { ...style };
  if (Object.keys(bucket).length) next[device] = bucket as StyleValues;
  else delete next[device];
  return next;
}

export const isEmptyStyle = (style: ElementStyle) => DEVICES.every((d) => !style[d] || Object.keys(style[d]!).length === 0);

// ---- inheritance --------------------------------------------------------------------------------------------------

export type StyleLayer = { source: string; style: ElementStyle };
export type ResolvedValue<T = unknown> = { value: T | undefined; source: string | null; device: StyleDevice | null };

/**
 * The value a property takes on `device`, and which layer set it. `layers` run from the most general (theme, section) to the
 * most specific (the element): the last layer that sets it wins. Within a layer a phone uses `mobile`, else `tablet`, else
 * `base`; a tablet uses `tablet`, else `base`. A missing result means the property is not overridden anywhere and the theme's
 * own styling applies.
 */
export function resolveStyleValue(layers: readonly StyleLayer[], key: StyleKey, device: StyleDevice = "base"): ResolvedValue {
  const order: StyleDevice[] = device === "mobile" ? ["mobile", "tablet", "base"] : device === "tablet" ? ["tablet", "base"] : ["base"];
  for (let i = layers.length - 1; i >= 0; i--) {
    for (const d of order) {
      const v = layers[i].style[d]?.[key];
      if (v !== undefined) return { value: v, source: layers[i].source, device: d };
    }
  }
  return { value: undefined, source: null, device: null };
}

// ---- parts of text ----------------------------------------------------------------------------------------------------

/** What one piece of text can carry on its own (see lib/editor/text.ts). */
export const PART_STYLE_KEYS = ["fontFamily", "fontSize", "fontWeight", "fontStyle", "lineHeight", "letterSpacing", "textTransform", "textDecoration", "color"] as const satisfies readonly StyleKey[];
export type PartStyleKey = (typeof PART_STYLE_KEYS)[number];
export type PartStyle = Pick<StyleValues, PartStyleKey>;
export const partStyleSchema = valuesSchema.pick(Object.fromEntries(PART_STYLE_KEYS.map((k) => [k, true])) as Record<PartStyleKey, true>).strict();

/** Validated declarations (`font-size:20px;color:#112233`) for one piece of text. */
export function partStyleDeclarations(style: PartStyle): string {
  const parsed = partStyleSchema.safeParse(style);
  return parsed.success ? declarations(parsed.data as StyleValues).join(";") : "";
}

// ---- CSS ----------------------------------------------------------------------------------------------------------

const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * The value of the `data-sf-ov` attribute that marks an element for its stylesheet rules. It always starts with a letter, so the
 * selector can be written without quotes; that keeps the stylesheet free of characters a text node would escape, and lets it
 * be rendered as plain `<style>` text, never as raw HTML.
 */
export const overrideValue = (id: string): string => `o_${id}`;
const TEXT_TAGS = "h1,h2,h3,h4,h5,h6,p,span,a,li,blockquote,label,button,dt,dd";
const TEXT_KEYS = new Set<StyleKey>(["fontFamily", "fontSize", "fontWeight", "fontStyle", "textAlign", "lineHeight", "letterSpacing", "textTransform", "textDecoration", "color"]);

export type CssTarget = {
  id: string;
  style: ElementStyle;
  /** Text properties also reach the text elements inside (blocks), not only inherit (sections). */
  textScope: boolean;
  /** A button block: its look (colour, corners, border, size) is applied to the button inside the wrapper, not to the wrapper. */
  control?: boolean;
};

function declarations(values: StyleValues, only?: (key: StyleKey) => boolean): string[] {
  const out: string[] = [];
  const v = values as Record<string, unknown>;
  for (const key of STYLE_KEYS) {
    if (v[key] === undefined || (only && !only(key))) continue;
    const n = v[key];
    switch (key) {
      case "fontFamily":
        out.push(`font-family:${FONT_REGISTRY[n as FontKey].fontFamily}`);
        break;
      // The theme draws headings from --sf-font-heading and body text from --sf-font-body, so a section changes them for itself only.
      case "headingFont":
        out.push(`--sf-font-heading:${FONT_REGISTRY[n as FontKey].fontFamily}`);
        break;
      case "bodyFont":
        out.push(`--sf-font-body:${FONT_REGISTRY[n as FontKey].fontFamily}`, "font-family:var(--sf-font-body)");
        break;
      case "fontSize":
      case "letterSpacing":
      case "maxWidth":
      case "minHeight":
      case "paddingTop":
      case "paddingBottom":
      case "paddingLeft":
      case "paddingRight":
      case "marginTop":
      case "marginBottom":
      case "borderRadius":
      case "borderWidth":
        out.push(`${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}:${n}px`);
        break;
      case "fontWeight":
      case "lineHeight":
        out.push(`${key === "fontWeight" ? "font-weight" : "line-height"}:${n}`);
        break;
      case "fontStyle":
        out.push(`font-style:${n}`);
        break;
      case "textAlign":
        out.push(`text-align:${n}`);
        break;
      case "textTransform":
        out.push(`text-transform:${n}`);
        break;
      case "textDecoration":
        out.push(`text-decoration:${n}`);
        break;
      case "color":
        out.push(`color:${n}`);
        break;
      case "backgroundColor":
        out.push(`background-color:${n}`);
        break;
      case "borderColor":
        out.push(`border-color:${n}`);
        break;
      case "opacity":
        out.push(`opacity:${(n as number) / 100}`);
        break;
      case "hidden":
        out.push(n ? "display:none" : "display:block");
        break;
    }
  }
  if (v.borderWidth !== undefined && (v.borderWidth as number) > 0 && (!only || only("borderWidth"))) out.push("border-style:solid");
  if (v.borderRadius !== undefined && (v.borderRadius as number) > 0 && (!only || only("borderRadius"))) out.push("overflow:hidden");
  return out;
}

/** A button block's wrapper keeps only its place on the page; everything visual belongs to the button inside it. */
const WRAPPER_KEYS = new Set<StyleKey>(["marginTop", "marginBottom", "textAlign", "opacity", "hidden"]);
const CONTROL_TAGS = "a,button";

function rulesFor(id: string, values: StyleValues, textScope: boolean, control: boolean): string {
  const attr = `[data-sf-ov=${overrideValue(id)}]`;
  const self = attr + attr;
  const rules: string[] = [];
  if (control) {
    const wrapper = declarations(values, (k) => WRAPPER_KEYS.has(k));
    // Three attribute selectors outrank the theme's own hover and focus classes, so a chosen colour holds on hover too.
    const button = declarations(values, (k) => !WRAPPER_KEYS.has(k));
    if (wrapper.length) rules.push(`${self}{${wrapper.join(";")}}`);
    if (button.length) rules.push(`${self}${attr} :where(${CONTROL_TAGS}){${button.join(";")}}`);
    return rules.join("");
  }
  const own = declarations(values);
  if (own.length) rules.push(`${self}{${own.join(";")}}`);
  if (textScope) {
    const inner = declarations(values, (k) => TEXT_KEYS.has(k));
    if (inner.length) rules.push(`${self} :where(${TEXT_TAGS}){${inner.join(";")}}`);
  }
  return rules.join("");
}

/**
 * The stylesheet for a set of elements. Every style is re-validated here, so a stored document that was edited by hand (or is
 * from a newer version) can never put anything but known properties with in-range values into the page.
 */
export function elementCss(targets: readonly CssTarget[]): string {
  let base = "";
  let tablet = "";
  let mobile = "";
  for (const t of targets) {
    if (!SAFE_ID.test(t.id)) continue;
    const style = parseElementStyle(t.style);
    if (!style) continue;
    if (style.base) base += rulesFor(t.id, style.base, t.textScope, !!t.control);
    if (style.tablet) tablet += rulesFor(t.id, style.tablet, t.textScope, !!t.control);
    if (style.mobile) mobile += rulesFor(t.id, style.mobile, t.textScope, !!t.control);
  }
  const css = base + (tablet ? `@media (max-width:1279px){${tablet}}` : "") + (mobile ? `@media (max-width:767px){${mobile}}` : "");
  // Defence in depth: nothing above can produce these, but a stylesheet that a text node would escape, or that could close its
  // own tag, is never emitted.
  return /[<>&"'\\]/.test(css) ? "" : css;
}
