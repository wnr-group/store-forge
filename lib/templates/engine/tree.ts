import type { ComponentNode, TemplateDocument } from "../document";
import { LIMITS } from "../limits";
import type { BlockDefinition, ComponentRegistry, SectionDefinition } from "./descriptors";
import { MAX_ID_ATTEMPTS, SAFE_NODE_ID_REGEX, collectUsedIds, generateId } from "./tree-ids";

export { generateId };

export interface NodeLocation {
  node: ComponentNode;
  id: string;
  parentId: string | null;
  parent: ComponentNode | null;
  isSection: boolean;
  depth: number;
}

/**
 * Own-property helpers: ids come from untrusted documents, and plain indexing would resolve names such as
 * "constructor" or "__proto__" to members of Object.prototype (or, on assignment, rewrite the prototype).
 */
function getOwn<T>(record: Record<string, T> | undefined, key: string): T | undefined {
  return record && Object.hasOwn(record, key) ? record[key] : undefined;
}

function setOwn<T>(record: Record<string, T>, key: string, value: T): void {
  Object.defineProperty(record, key, { value, writable: true, enumerable: true, configurable: true });
}

/** An own `__proto__` key is never a node id (see SAFE_NODE_ID_REGEX): neither it nor anything below it is navigable. */
const UNNAVIGABLE_ID = "__proto__";

export function findNode(doc: TemplateDocument, nodeId: string): NodeLocation | null {
  if (nodeId === UNNAVIGABLE_ID) return null;
  if (getOwn(doc.sections, nodeId)) {
    return {
      node: doc.sections[nodeId],
      id: nodeId,
      parentId: null,
      parent: null,
      isSection: true,
      depth: 0,
    };
  }

  function searchInBlock(
    blockId: string,
    blockNode: ComponentNode,
    parentId: string,
    parentNode: ComponentNode,
    currentDepth: number,
  ): NodeLocation | null {
    if (blockId === nodeId) {
      return {
        node: blockNode,
        id: blockId,
        parentId,
        parent: parentNode,
        isSection: false,
        depth: currentDepth,
      };
    }

    const blocks = blockNode.blocks || {};
    for (const childId of Object.keys(blocks)) {
      if (childId === UNNAVIGABLE_ID) continue;
      const found = searchInBlock(childId, blocks[childId], blockId, blockNode, currentDepth + 1);
      if (found) return found;
    }

    return null;
  }

  const sections = doc.sections || {};
  for (const secId of Object.keys(sections)) {
    if (secId === UNNAVIGABLE_ID) continue;
    const sec = sections[secId];
    const blocks = sec.blocks || {};
    for (const bId of Object.keys(blocks)) {
      if (bId === UNNAVIGABLE_ID) continue;
      const found = searchInBlock(bId, blocks[bId], secId, sec, 1);
      if (found) return found;
    }
  }

  return null;
}

export function depthOf(doc: TemplateDocument, nodeId: string): number {
  const loc = findNode(doc, nodeId);
  return loc ? loc.depth : -1;
}

export function countComponents(doc: TemplateDocument): number {
  let count = 0;
  function countBlock(node: ComponentNode) {
    count++;
    for (const child of Object.values(node.blocks || {})) {
      countBlock(child);
    }
  }
  for (const sec of Object.values(doc.sections || {})) {
    count++;
    for (const block of Object.values(sec.blocks || {})) {
      countBlock(block);
    }
  }
  return count;
}

export function subtreeDepth(node: ComponentNode): number {
  let max = 0;
  function walk(n: ComponentNode, current: number) {
    if (current > max) max = current;
    for (const child of Object.values(n.blocks || {})) {
      walk(child, current + 1);
    }
  }
  walk(node, 0);
  return max;
}

export function isDescendant(doc: TemplateDocument, ancestorId: string, candidateDescendantId: string): boolean {
  if (ancestorId === candidateDescendantId) return true;
  const ancestorLoc = findNode(doc, ancestorId);
  if (!ancestorLoc) return false;

  let found = false;
  function walk(bId: string, node: ComponentNode) {
    if (bId === candidateDescendantId) {
      found = true;
      return;
    }
    for (const [cId, child] of Object.entries(node.blocks || {})) {
      walk(cId, child);
      if (found) return;
    }
  }

  walk(ancestorId, ancestorLoc.node);
  return found;
}

/** Nodes in the subtree rooted at `node`, itself included. */
function subtreeSize(node: ComponentNode): number {
  let size = 1;
  for (const child of Object.values(node.blocks || {})) size += subtreeSize(child);
  return size;
}

/**
 * Nodes `duplicateNode` creates for the subtree at `node`: itself plus the children listed in `block_order`,
 * all the way down. A child missing from `block_order` is dropped by the copy, so it is not counted.
 */
function copySize(node: ComponentNode): number {
  let size = 1;
  for (const childId of node.block_order || []) {
    const child = getOwn(node.blocks, childId);
    if (child) size += copySize(child);
  }
  return size;
}

const childCount = (node: ComponentNode): number => Object.keys(node.blocks || {}).length;

/** The registry definition of the section or block at `loc`, if its type is registered. */
function definitionOf(registry: ComponentRegistry, loc: NodeLocation): SectionDefinition | BlockDefinition | undefined {
  return loc.isSection ? getOwn(registry.sections, loc.node.type) : getOwn(registry.blocks, loc.node.type);
}

/** Id of the section that holds (or is) the node `id`, or null when the node is not in the document. */
function sectionIdOf(doc: TemplateDocument, id: string): string | null {
  for (const sectionId of Object.keys(doc.sections || {})) {
    if (isDescendant(doc, sectionId, id)) return sectionId;
  }
  return null;
}

export interface CanMoveResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Why `index` is not a position in a list of `length` entries (0 through length, the last meaning "append"),
 * or null when it is. A position is a whole number (negative zero counts as 0): NaN, Infinity and fractions
 * are refused, and nothing is clamped silently.
 */
function indexProblem(index: unknown, length: number): string | null {
  if (typeof index !== "number" || !Number.isInteger(index)) {
    return "Index must be a whole number, 0 or more";
  }
  if (index < 0 || index > length) return `Index ${index} is outside the valid positions 0 to ${length}`;
  return null;
}

/** Entries a target list holds once the moved node is out of it (a node already in the list leaves a gap). */
const lengthWithout = (order: readonly string[] | undefined, nodeId: string): number =>
  (order || []).filter((id) => id !== nodeId).length;

/** `index` is the final position of the node among its new siblings: 0 through the sibling count (append). */
export function canMove(
  doc: TemplateDocument,
  nodeId: string,
  targetParentId: string | null,
  index: number,
  registry?: ComponentRegistry,
): CanMoveResult {
  const nodeLoc = findNode(doc, nodeId);
  if (!nodeLoc) {
    return { allowed: false, reason: "Node not found" };
  }
  // Shape first (NaN, fractions, negatives); the upper bound needs the target list, checked where it is known.
  const badIndex = indexProblem(index, Number.POSITIVE_INFINITY);
  if (badIndex) return { allowed: false, reason: badIndex };

  // Moving a section
  if (nodeLoc.isSection) {
    if (targetParentId !== null) {
      return { allowed: false, reason: "Sections can only be placed at the root" };
    }
    const sectionRange = indexProblem(index, lengthWithout(doc.order, nodeId));
    return sectionRange ? { allowed: false, reason: sectionRange } : { allowed: true };
  }

  // Moving a block
  if (targetParentId === null) {
    return { allowed: false, reason: "Blocks must have a parent section or block" };
  }

  // Cycle check: cannot move into itself or any descendant (D10, AC-ENG-009)
  if (isDescendant(doc, nodeId, targetParentId)) {
    return { allowed: false, reason: "Cannot move a node into itself or its descendant" };
  }

  const targetParentLoc = findNode(doc, targetParentId);
  if (!targetParentLoc) {
    return { allowed: false, reason: "Target parent not found" };
  }
  const blockRange = indexProblem(index, lengthWithout(targetParentLoc.node.block_order, nodeId));
  if (blockRange) return { allowed: false, reason: blockRange };

  // Depth check: targetParent depth + 1 + subtreeDepth(node) <= LIMITS.maxBlockDepth (3)
  const incomingSubtreeDepth = subtreeDepth(nodeLoc.node);
  const resultingMaxDepth = targetParentLoc.depth + 1 + incomingSubtreeDepth;
  if (resultingMaxDepth > LIMITS.maxBlockDepth) {
    return {
      allowed: false,
      reason: `Move would exceed maximum block depth of ${LIMITS.maxBlockDepth}`,
    };
  }

  // Registry rules: accepts, then maxChildren (a reorder inside the same parent adds no child).
  if (registry) {
    const parentDef = definitionOf(registry, targetParentLoc);
    if (parentDef?.accepts && !parentDef.accepts.includes(nodeLoc.node.type)) {
      return {
        allowed: false,
        reason: `Target parent does not accept blocks of type '${nodeLoc.node.type}'`,
      };
    }
    const reorder = nodeLoc.parentId === targetParentId;
    if (!reorder && parentDef?.maxChildren !== undefined && childCount(targetParentLoc.node) >= parentDef.maxChildren) {
      return { allowed: false, reason: `Target parent already has its maximum of ${parentDef.maxChildren} children` };
    }
  }

  // Component limits: a move never changes the total, but it can overfill the target section's block budget.
  if (sectionIdOf(doc, nodeId) !== sectionIdOf(doc, targetParentId)) {
    const target = findNode(doc, sectionIdOf(doc, targetParentId) as string)!;
    if (subtreeSize(target.node) - 1 + subtreeSize(nodeLoc.node) > LIMITS.maxBlocksPerSection) {
      return { allowed: false, reason: `Move would exceed the maximum of ${LIMITS.maxBlocksPerSection} blocks in a section` };
    }
  }

  return { allowed: true };
}

function cloneNode(node: ComponentNode): ComponentNode {
  return JSON.parse(JSON.stringify(node));
}

function cloneDoc(doc: TemplateDocument): TemplateDocument {
  return JSON.parse(JSON.stringify(doc));
}

export function moveNode(
  doc: TemplateDocument,
  nodeId: string,
  targetParentId: string | null,
  index: number,
  registry?: ComponentRegistry,
): TemplateDocument {
  const check = canMove(doc, nodeId, targetParentId, index, registry);
  if (!check.allowed) {
    throw new Error(`Cannot move node: ${check.reason}`);
  }

  const cloned = cloneDoc(doc);
  const nodeLoc = findNode(cloned, nodeId)!;
  const nodeToMove = cloneNode(nodeLoc.node);

  // 1. Remove from original position
  if (nodeLoc.isSection) {
    delete cloned.sections[nodeId];
    cloned.order = cloned.order.filter((id) => id !== nodeId);
  } else {
    const parentLoc = findNode(cloned, nodeLoc.parentId!)!;
    delete parentLoc.node.blocks[nodeId];
    parentLoc.node.block_order = parentLoc.node.block_order.filter((id) => id !== nodeId);
  }

  // 2. Insert into target position
  if (targetParentId === null) {
    setOwn(cloned.sections, nodeId, nodeToMove);
    cloned.order.splice(index, 0, nodeId); // canMove vouched for the position
  } else {
    const targetParentLoc = findNode(cloned, targetParentId)!;
    if (!targetParentLoc.node.blocks) targetParentLoc.node.blocks = {};
    if (!targetParentLoc.node.block_order) targetParentLoc.node.block_order = [];

    setOwn(targetParentLoc.node.blocks, nodeId, nodeToMove);
    targetParentLoc.node.block_order.splice(index, 0, nodeId);
  }

  return cloned;
}

/** Position for addNode: undefined appends, anything else must pass `indexProblem` (0 through `length`). */
function checkedAddIndex(index: number | undefined, length: number): number {
  if (index === undefined) return length;
  const problem = indexProblem(index, length);
  if (problem) throw new Error(`Cannot add node: ${problem}`);
  return index;
}

/**
 * Adds a copy of `node` under `targetParentId` (null for a section) and returns the new document and the id.
 * A `customId` must be a safe string that no section or block in the document already uses, and `index`, when
 * given, a position from 0 through the sibling count (the same rule as moveNode), otherwise this throws and
 * nothing changes; without a custom id a fresh id is generated, without an index the node is appended.
 */
export function addNode(
  doc: TemplateDocument,
  targetParentId: string | null,
  node: ComponentNode,
  index?: number,
  customId?: string,
): { doc: TemplateDocument; id: string } {
  const cloned = cloneDoc(doc);
  const used = collectUsedIds(cloned);
  let newId: string;
  if (customId !== undefined) {
    if (typeof customId !== "string" || !SAFE_NODE_ID_REGEX.test(customId)) {
      throw new Error("Cannot add node: the id must be 1 to 128 letters, digits, - or _");
    }
    if (used.has(customId)) throw new Error(`Cannot add node: the id '${customId}' already exists in this document`);
    newId = customId;
  } else {
    const prefix = targetParentId === null ? "sec" : "blk";
    let attempt = 0;
    do {
      if (attempt++ >= MAX_ID_ATTEMPTS) throw new Error("Cannot add node: could not generate an unused id");
      newId = generateId(prefix);
    } while (used.has(newId));
  }
  const nodeToAdd = cloneNode(node);

  if (targetParentId === null) {
    if (Object.keys(cloned.sections || {}).length >= LIMITS.maxSectionsPerTemplate) {
      throw new Error(`Cannot add section: maximum limit of ${LIMITS.maxSectionsPerTemplate} reached`);
    }
    const orderIndex = checkedAddIndex(index, cloned.order.length);
    setOwn(cloned.sections, newId, nodeToAdd);
    cloned.order.splice(orderIndex, 0, newId);
  } else {
    const parentLoc = findNode(cloned, targetParentId);
    if (!parentLoc) throw new Error("Target parent not found");

    if (!parentLoc.node.blocks) parentLoc.node.blocks = {};
    if (!parentLoc.node.block_order) parentLoc.node.block_order = [];

    const blockIndex = checkedAddIndex(index, parentLoc.node.block_order.length);
    setOwn(parentLoc.node.blocks, newId, nodeToAdd);
    parentLoc.node.block_order.splice(blockIndex, 0, newId);
  }

  return { doc: cloned, id: newId };
}

export function removeNode(doc: TemplateDocument, nodeId: string): TemplateDocument {
  const cloned = cloneDoc(doc);
  const nodeLoc = findNode(cloned, nodeId);
  if (!nodeLoc) return cloned;

  if (nodeLoc.isSection) {
    delete cloned.sections[nodeId];
    cloned.order = cloned.order.filter((id) => id !== nodeId);
  } else {
    const parentLoc = findNode(cloned, nodeLoc.parentId!)!;
    delete parentLoc.node.blocks[nodeId];
    parentLoc.node.block_order = parentLoc.node.block_order.filter((id) => id !== nodeId);
  }

  return cloned;
}

/**
 * Duplicates a node and its whole subtree right after the original. Every copied node gets a fresh id that
 * matches no id already in the document (a colliding id from the generator is simply drawn again). The
 * duplicate respects the same limits as the validator: sections, components, blocks per section and, when a
 * `registry` is given, the parent's maxChildren. Nothing is changed when a limit refuses it.
 */
export function duplicateNode(
  doc: TemplateDocument,
  nodeId: string,
  idGenerator: (prefix?: string) => string = generateId,
  registry?: ComponentRegistry,
): { doc: TemplateDocument; newId: string } {
  const cloned = cloneDoc(doc);
  const nodeLoc = findNode(cloned, nodeId);
  if (!nodeLoc) throw new Error("Node to duplicate not found");

  const added = copySize(nodeLoc.node);
  if (nodeLoc.isSection) {
    if (Object.keys(cloned.sections).length >= LIMITS.maxSectionsPerTemplate) {
      throw new Error(`Cannot duplicate section: maximum limit of ${LIMITS.maxSectionsPerTemplate} sections reached`);
    }
  } else {
    const section = findNode(cloned, sectionIdOf(cloned, nodeId) as string)!;
    if (subtreeSize(section.node) - 1 + added > LIMITS.maxBlocksPerSection) {
      throw new Error(`Cannot duplicate: the section would exceed the maximum of ${LIMITS.maxBlocksPerSection} blocks`);
    }
    const parentDef = registry ? definitionOf(registry, findNode(cloned, nodeLoc.parentId!)!) : undefined;
    if (parentDef?.maxChildren !== undefined && childCount(nodeLoc.parent!) >= parentDef.maxChildren) {
      throw new Error(`Cannot duplicate: the parent already has its maximum of ${parentDef.maxChildren} children`);
    }
  }
  if (countComponents(cloned) + added > LIMITS.maxComponentsPerTemplate) {
    throw new Error(`Cannot duplicate: the template would exceed the maximum of ${LIMITS.maxComponentsPerTemplate} components`);
  }

  const used = collectUsedIds(cloned);

  function freshId(prefix: string): string {
    for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt++) {
      const id = idGenerator(prefix);
      // An id becomes an object key: "undefined" or "" must never be stored for a broken generator.
      if (typeof id !== "string" || id.trim() === "") {
        throw new Error("Cannot duplicate: the id generator returned an invalid id (a non-empty string is required)");
      }
      if (!used.has(id)) {
        used.add(id);
        return id;
      }
    }
    throw new Error("Cannot duplicate: the id generator did not produce a unique id");
  }

  function regenerateIds(node: ComponentNode): ComponentNode {
    const newBlocks: Record<string, ComponentNode> = {};
    const newBlockOrder: string[] = [];

    for (const oldChildId of node.block_order || []) {
      const oldChild = getOwn(node.blocks, oldChildId);
      if (oldChild) {
        const freshChildId = freshId("blk");
        setOwn(newBlocks, freshChildId, regenerateIds(oldChild));
        newBlockOrder.push(freshChildId);
      }
    }

    return {
      ...cloneNode(node),
      blocks: newBlocks,
      block_order: newBlockOrder,
    };
  }

  const newId = freshId(nodeLoc.isSection ? "sec" : "blk");
  const duplicatedNode = regenerateIds(nodeLoc.node);

  if (nodeLoc.isSection) {
    setOwn(cloned.sections, newId, duplicatedNode);
    const origIndex = cloned.order.indexOf(nodeId);
    cloned.order.splice(origIndex + 1, 0, newId);
  } else {
    const parentLoc = findNode(cloned, nodeLoc.parentId!)!;
    setOwn(parentLoc.node.blocks, newId, duplicatedNode);
    const origIndex = parentLoc.node.block_order.indexOf(nodeId);
    parentLoc.node.block_order.splice(origIndex + 1, 0, newId);
  }

  return { doc: cloned, newId };
}
