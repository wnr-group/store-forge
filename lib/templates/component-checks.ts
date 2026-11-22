/**
 * Editor-side checks for the gated Studio components: wording and link problems of what a merchant typed, and whether a component
 * may be added or published. Pure; the server readiness rules mirror them (the API is the authority).
 */
import { checkComponentUnavailable, resolveAvailability, type ComponentUnavailableIssue, type UnavailableReason } from "./availability";
import { validateCountdownSettings } from "./countdown";
import type { ComponentNode, TemplateDocument } from "./document";
import { walkKeys } from "./engine/tree-walk";
import { manifestMap } from "./manifests";
import { manifestKey, type ComponentManifest } from "./manifest";
import { availabilityContextFor, type StudioFeatures } from "./studio-features";
import { validateBadgeSettings } from "./trust-badges";

let cached: Map<string, ComponentManifest> | null = null;
const manifests = (): Map<string, ComponentManifest> => (cached ??= manifestMap());

/** The sections and order of a document of unknown shape; anything that is not a tree reads as an empty page. */
function asTree(input: unknown): Pick<TemplateDocument, "sections" | "order"> {
  const r = input !== null && typeof input === "object" ? (input as { sections?: unknown; order?: unknown }) : {};
  const sections = r.sections !== null && typeof r.sections === "object" && !Array.isArray(r.sections) ? (r.sections as Record<string, ComponentNode>) : {};
  return { sections, order: Array.isArray(r.order) ? (r.order as string[]) : [] };
}

export type ComponentAvailability = { available: true } | { available: false; reasons: UnavailableReason[] };

/** Whether a section or block type may be added (and published) for a store with these features. A type with no manifest is available. */
export function availabilityOf(kind: "section" | "block", type: string, features: StudioFeatures | undefined): ComponentAvailability {
  const manifest = manifests().get(manifestKey({ kind, id: type }));
  if (!manifest) return { available: true };
  return resolveAvailability(manifest, availabilityContextFor(features));
}

/** Publishing blockers: one issue per used component that is unavailable (the `component.unavailable` rule). */
export function unavailableIssuesOf(input: unknown, features: StudioFeatures | undefined): ComponentUnavailableIssue[] {
  const doc = asTree(input);
  return checkComponentUnavailable(doc, manifests(), availabilityContextFor(features));
}

/**
 * Problems of the countdown and trust badge settings in a document, keyed by document path (like the engine validator's issues, e.g.
 * `sections.s1.blocks.b1.settings.link`), so the editor shows them beside the field.
 */
export function studioComponentProblems(input: unknown): Record<string, string> {
  const doc = asTree(input);
  const out: Record<string, string> = {};
  const add = (base: string, problems: Record<string, string>) => {
    for (const [field, message] of Object.entries(problems)) out[`${base}.${field}`] = message;
  };
  for (const id of walkKeys(doc.order ?? [], doc.sections ?? {})) {
    const section: ComponentNode | undefined = doc.sections[id];
    if (!section) continue;
    if (section.type === "countdown") add(`sections.${id}.settings`, validateCountdownSettings(section.settings));
    for (const blockId of walkKeys(section.block_order ?? [], section.blocks ?? {})) {
      const block = section.blocks[blockId];
      if (block?.type === "trust-badge") add(`sections.${id}.blocks.${blockId}.settings`, validateBadgeSettings(block.settings));
    }
  }
  return out;
}
