/**
 * Removes the sections and blocks whose schedule is not active at `now`, so an inactive node never reaches the HTML or the client
 * payload. Pure and structural-sharing: a document with nothing to remove is returned as the same object.
 */
import type { ComponentNode } from "./document";
import { countdownKeepsAfterEnd } from "./countdown";
import { evaluateDisplay, parseDisplayRules, type DisplayRule, type DisplayRules } from "./display-rules";

/** The server clock in epoch ms. The only place the clock is read for schedules; never fed from a request. */
export const serverClock = (): number => Date.now();

/** True when the node is shown at `now`. A node with no `display` is always shown; one with malformed rules is not (fail closed). */
export function isNodeActive(node: Pick<ComponentNode, "display"> & Partial<Pick<ComponentNode, "type" | "settings">>, now: number): boolean {
  if (node.display === undefined) return true;
  const rules = parseDisplayRules(node.display);
  if (rules === null) return false;
  // A countdown that follows its schedule end and shows a message at zero stays in the page after that end: the countdown itself
  // then shows the (protected) message. Only the END is lifted; the start and device rules are unchanged.
  if (node.type !== undefined && node.settings !== undefined && countdownKeepsAfterEnd({ type: node.type, settings: node.settings })) {
    return evaluateDisplay(withoutScheduleEnd(rules), now).show;
  }
  return evaluateDisplay(rules, now).show;
}

function withoutScheduleEnd(rules: DisplayRules): DisplayRules {
  return {
    ...rules,
    rules: rules.rules.flatMap((r): DisplayRule[] => {
      if (r.type !== "schedule") return [r];
      const { endsAt: _endsAt, ...rest } = r;
      return rest.startsAt === undefined ? [] : [rest];
    }),
  };
}

function pruneNode(node: ComponentNode, now: number): ComponentNode {
  const blocks = node.blocks ?? {};
  let changed = false;
  const nextBlocks: Record<string, ComponentNode> = {};
  for (const [id, child] of Object.entries(blocks)) {
    if (!isNodeActive(child, now)) {
      changed = true;
      continue;
    }
    const pruned = pruneNode(child, now);
    if (pruned !== child) changed = true;
    nextBlocks[id] = pruned;
  }
  if (!changed) return node;
  return { ...node, blocks: nextBlocks, block_order: (node.block_order ?? []).filter((id) => Object.hasOwn(nextBlocks, id)) };
}

type Tree = { sections?: Record<string, ComponentNode>; order?: string[] };

export function pruneInactiveNodes<T extends Tree>(doc: T, now: number): T {
  if (!doc?.sections) return doc;
  let changed = false;
  const sections: Record<string, ComponentNode> = {};
  for (const [id, section] of Object.entries(doc.sections)) {
    if (!isNodeActive(section, now)) {
      changed = true;
      continue;
    }
    const pruned = pruneNode(section, now);
    if (pruned !== section) changed = true;
    sections[id] = pruned;
  }
  if (!changed) return doc;
  return { ...doc, sections, ...(doc.order ? { order: doc.order.filter((id) => Object.hasOwn(sections, id)) } : {}) };
}
