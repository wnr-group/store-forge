export type CollectionUsageRef = { templateId: string; templateName: string; kind: string; location: string; sectionId: string; inDraft: boolean; inPublished: boolean };
export type CollectionUsage = { total: number; hash: string; references: CollectionUsageRef[] };

const PLAIN = "The collection and its image are removed. The products in it are kept.";
const state = (r: CollectionUsageRef) => (r.inPublished && r.inDraft ? "live and draft" : r.inPublished ? "live" : "draft");

/** The text of the delete confirmation: the plain wording when nothing uses the collection, else where it is used. */
export function describeCollectionUsage(usage: CollectionUsage | null, name: string): string {
  if (!usage || usage.total === 0) return PLAIN;
  const where = usage.references.map((r) => `${r.templateName} (${r.location}, ${state(r)})`).join("; ");
  const n = usage.total;
  return `"${name}" is used by ${n} ${n === 1 ? "section" : "sections"} of your store design: ${where}. Deleting it hides ${n === 1 ? "that section" : "those sections"} from shoppers until you choose another collection. The products in it are kept.`;
}
