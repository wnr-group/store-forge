/**
 * First-party manifests, derived from the component registry plus the hand-written table in `./metadata.ts`. Nothing is
 * stored: the registry is the source of truth, so a manifest cannot drift from the settings it points at (the committed
 * bundle is checked against this output by a unit test).
 */
import { getRegistry } from "../registry/index";
import { MANIFEST_VERSION, manifestKey, validateManifest, type ComponentManifest, type ManifestPermission } from "../manifest";
import { SUPPORTED_SCHEMA_VERSIONS } from "../document";
import type { BlockDefinition, SectionDefinition } from "../engine/descriptors";
import { BLOCK_META, DATA_SOURCE_PERMISSION, SECTION_META, type ComponentMeta } from "./metadata";

const COMPONENT_VERSION = "1.0.0";

function derive(kind: "section" | "block", def: SectionDefinition | BlockDefinition, meta: ComponentMeta, category: string, derivedSlots: string[]): ComponentManifest {
  const allowedSlots = meta.allowedSlots ?? derivedSlots;
  const dataSources = [...(meta.dataSources ?? [])];
  const permissions = new Set<ManifestPermission>(dataSources.map((d) => DATA_SOURCE_PERMISSION[d]));
  // Image settings read the media library.
  if (def.settings.some((s) => s.type === "image")) permissions.add("media:read");
  const candidate: ComponentManifest = {
    manifestVersion: MANIFEST_VERSION,
    kind,
    id: def.type,
    name: def.name,
    description: def.description ?? "",
    componentVersion: COMPONENT_VERSION,
    category,
    tags: [kind, category.toLowerCase()],
    allowedSlots,
    dataSources,
    permissions: [...permissions].sort(),
    requiresPurchaseFlow: false,
    attestation: meta.attestationWordingKey ? { required: true, wordingKey: meta.attestationWordingKey } : { required: false },
    legal: meta.legalFeatureKey ? { required: true, featureKey: meta.legalFeatureKey } : { required: false },
    compatibility: {
      documentSchemaVersions: [...SUPPORTED_SCHEMA_VERSIONS],
      accepts: [...(def.accepts ?? [])],
      ...(def.maxChildren === undefined ? {} : { maxChildren: def.maxChildren }),
      settingsRef: `registry:${kind}s/${def.type}`,
    },
    availability: "available",
    supports: { displayRules: meta.displayRules, reusable: meta.reusable, copyPaste: meta.copyPaste },
    protectedParts: [...(meta.protectedParts ?? [])],
    messageKeys: [...(meta.messageKeys ?? [])],
    readinessRules: ["component.unavailable"],
  };
  const result = validateManifest(candidate);
  if (!result.ok) throw new Error(`First-party manifest ${kind}:${def.type} is invalid. ${result.message}`);
  return result.manifest;
}

/** Every first-party manifest: sections first, then blocks, each in registry order. */
export function buildFirstPartyManifests(): ComponentManifest[] {
  const registry = getRegistry();
  const parents = (blockType: string): string[] =>
    [...Object.values(registry.sections), ...Object.values(registry.blocks)].filter((d) => d.accepts?.includes(blockType)).map((d) => d.type);
  const out: ComponentManifest[] = [];
  for (const def of Object.values(registry.sections)) {
    const meta = SECTION_META[def.type];
    if (!meta) throw new Error(`No manifest metadata for section "${def.type}"`);
    out.push(derive("section", def, meta, def.category ?? "General", ["page"]));
  }
  for (const def of Object.values(registry.blocks)) {
    const meta = BLOCK_META[def.type];
    if (!meta) throw new Error(`No manifest metadata for block "${def.type}"`);
    out.push(derive("block", def, meta, meta.category ?? "General", [...new Set(parents(def.type))]));
  }
  return out;
}

export function manifestMap(manifests: readonly ComponentManifest[] = buildFirstPartyManifests()): Map<string, ComponentManifest> {
  return new Map(manifests.map((m) => [manifestKey(m), m]));
}
