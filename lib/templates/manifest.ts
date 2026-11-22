/**
 * Component manifest: a versioned, declarative, plain-data description of one section or block type. The registry
 * descriptors stay the source of truth for settings; a manifest adds the platform metadata around them (what data it reads,
 * what it needs approved, where it may sit, what it supports). No React, database or server-only imports.
 */
import { z } from "zod";

export const MANIFEST_VERSION = 1;

/** The closed set of permissions a component may declare. */
export const MANIFEST_PERMISSIONS = Object.freeze([
  "reviews:read",
  "products:read",
  "collections:read",
  "cart:read",
  "storefront:read",
  "media:read",
] as const);
export type ManifestPermission = (typeof MANIFEST_PERMISSIONS)[number];

export const MANIFEST_AVAILABILITIES = Object.freeze(["available", "unavailable", "deprecated"] as const);
export type ManifestAvailability = (typeof MANIFEST_AVAILABILITIES)[number];

export const MANIFEST_KINDS = Object.freeze(["section", "block"] as const);
export type ManifestKind = (typeof MANIFEST_KINDS)[number];

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const KEY = /^[a-z][a-z0-9-]*$/;
const DOTTED_KEY = /^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9-]+)+$/;
/** A legal feature key or attestation wording key: a dotted key ("feature.x") or a single snake_case word ("trust_badges"). */
const FEATURE_KEY = /^[a-z][a-z0-9_]*(\.[A-Za-z0-9-]+)*$/;

const text = z.string().min(1).max(200);
const keyList = z.array(z.string().min(1).max(100)).max(100);

export const componentManifestSchema = z
  .object({
    manifestVersion: z.literal(MANIFEST_VERSION),
    /** "section" or "block"; the registry keeps the two type namespaces apart. */
    kind: z.enum(MANIFEST_KINDS),
    id: z.string().regex(KEY).max(64),
    name: text,
    description: z.string().max(500),
    componentVersion: z.string().regex(SEMVER).max(64),
    category: text,
    tags: keyList,
    /** Parent types that may hold this component (a section: the page itself). */
    allowedSlots: keyList,
    dataSources: keyList,
    permissions: z.array(z.enum(MANIFEST_PERMISSIONS)).max(MANIFEST_PERMISSIONS.length),
    requiresPurchaseFlow: z.boolean(),
    attestation: z.object({ required: z.boolean(), wordingKey: z.string().regex(FEATURE_KEY).max(64).optional() }).strict(),
    legal: z.object({ required: z.boolean(), featureKey: z.string().regex(FEATURE_KEY).max(64).optional() }).strict(),
    compatibility: z
      .object({
        documentSchemaVersions: z.array(z.number().int().positive()).min(1),
        /** Child types this component accepts (from the registry). */
        accepts: keyList,
        maxChildren: z.number().int().nonnegative().optional(),
        /** Where the settings descriptors live, e.g. "registry:sections/hero". */
        settingsRef: z.string().min(1).max(200),
      })
      .strict(),
    availability: z.enum(MANIFEST_AVAILABILITIES),
    supports: z.object({ displayRules: z.boolean(), reusable: z.boolean(), copyPaste: z.boolean() }).strict(),
    protectedParts: keyList,
    messageKeys: z.array(z.string().regex(DOTTED_KEY)).max(100),
    readinessRules: keyList,
  })
  .strict()
  .superRefine((m, ctx) => {
    if (m.attestation.required && !m.attestation.wordingKey) {
      ctx.addIssue({ code: "custom", path: ["attestation", "wordingKey"], message: "required" });
    }
    if (m.legal.required && !m.legal.featureKey) {
      ctx.addIssue({ code: "custom", path: ["legal", "featureKey"], message: "required" });
    }
  });

export type ComponentManifest = z.infer<typeof componentManifestSchema>;

export type ManifestValidation =
  | { ok: true; manifest: ComponentManifest }
  | { ok: false; fields: string[]; message: string };

/**
 * Validate untrusted manifest data. A failure lists the FIELD NAMES (dotted paths) that are missing or invalid and never echoes
 * a value: a manifest is configuration, but an error must still be safe to log and to return.
 */
export function validateManifest(input: unknown): ManifestValidation {
  const parsed = componentManifestSchema.safeParse(input);
  if (parsed.success) return { ok: true, manifest: parsed.data };
  const fields = [...new Set(parsed.error.issues.flatMap((i) => (i.code === "unrecognized_keys" ? i.keys.map((k) => [...i.path, k]) : [i.path])).map((p) => p.map(String).join(".") || "(manifest)"))];
  return { ok: false, fields, message: `Invalid component manifest. Fields: ${fields.join(", ")}` };
}

export function manifestKey(m: Pick<ComponentManifest, "kind" | "id">): string {
  return `${m.kind}:${m.id}`;
}
