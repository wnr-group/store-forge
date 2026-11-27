"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, CornerDownRight, FolderPlus, MoreHorizontal, Package, Pencil, Trash2 } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { childLevel } from "@/lib/catalog/tree";
import type { CatalogLevel, CatalogNode, CatalogTreeNode } from "@/lib/catalog/types";
import { cn } from "@/lib/utils";

export type NodeActions = {
  onAddChild: (node: CatalogTreeNode) => void;
  onEdit: (node: CatalogTreeNode) => void;
  onMove: (node: CatalogTreeNode) => void;
  onDelete: (node: CatalogTreeNode) => void;
  onProducts: (node: CatalogTreeNode) => void;
  onShift: (node: CatalogTreeNode, direction: -1 | 1) => void;
};

/** One row of the tree or of a search result: the item, its level, status, products and the actions the member may use. */
export function NodeRow({ node, levels, canManage, canDelete, actions, depth = 0, siblings, index, leading }: { node: CatalogNode; levels: CatalogLevel[]; canManage: boolean; canDelete: boolean; actions: NodeActions; depth?: number; siblings?: number; index?: number; leading?: React.ReactNode }) {
  const level = levels.find((l) => l.id === node.levelId);
  const below = childLevel(levels, node);
  const asTree = node as CatalogTreeNode;
  return (
    <div className="flex flex-wrap items-center gap-2 py-1.5 pr-2" style={{ paddingLeft: `${depth * 1.25 + 0.5}rem` }}>
      {leading ?? <span className="size-6 shrink-0" aria-hidden />}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{node.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {node.levelName} · /{node.slug}
          {node.childCount > 0 ? ` · ${node.childCount} below` : ""}
        </p>
      </div>
      <StatusBadge tone={node.status === "active" ? "active" : "draft"}>{node.status === "active" ? "Active" : "Draft"}</StatusBadge>
      {level?.canHoldProducts ? (
        <button type="button" onClick={() => actions.onProducts(asTree)} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" aria-label={`${node.productCount} products on ${node.name}. Manage products`}>
          <Package className="size-3.5" aria-hidden /> {node.productCount}
        </button>
      ) : null}
      {canManage || canDelete ? (
        <DropdownMenu>
          <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))} aria-label={`Actions for ${node.name}`}>
            <MoreHorizontal aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48">
            {canManage && level?.canHoldProducts ? (
              <DropdownMenuItem onClick={() => actions.onProducts(asTree)}>
                <Package aria-hidden /> Products
              </DropdownMenuItem>
            ) : null}
            {canManage && below ? (
              <DropdownMenuItem onClick={() => actions.onAddChild(asTree)}>
                <FolderPlus aria-hidden /> Add {below.name.toLowerCase()}
              </DropdownMenuItem>
            ) : null}
            {canManage ? (
              <DropdownMenuItem onClick={() => actions.onEdit(asTree)}>
                <Pencil aria-hidden /> Edit
              </DropdownMenuItem>
            ) : null}
            {canManage && node.levelPosition > 1 ? (
              <DropdownMenuItem onClick={() => actions.onMove(asTree)}>
                <CornerDownRight aria-hidden /> Move to another parent
              </DropdownMenuItem>
            ) : null}
            {canManage && siblings !== undefined && index !== undefined ? (
              <>
                <DropdownMenuItem disabled={index === 0} onClick={() => actions.onShift(asTree, -1)}>
                  <ArrowUp aria-hidden /> Move up
                </DropdownMenuItem>
                <DropdownMenuItem disabled={index >= siblings - 1} onClick={() => actions.onShift(asTree, 1)}>
                  <ArrowDown aria-hidden /> Move down
                </DropdownMenuItem>
              </>
            ) : null}
            {canDelete ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => actions.onDelete(asTree)}>
                  <Trash2 aria-hidden /> Delete
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}

function Branch({ nodes, depth, expanded, toggle, ...rest }: { nodes: CatalogTreeNode[]; depth: number; expanded: Set<string>; toggle: (id: string) => void; levels: CatalogLevel[]; canManage: boolean; canDelete: boolean; actions: NodeActions }) {
  return (
    <ul role={depth === 0 ? "tree" : "group"} className={depth === 0 ? "divide-y rounded-md border" : "divide-y border-t"}>
      {nodes.map((node, i) => {
        const open = expanded.has(node.id);
        const has = node.children.length > 0;
        return (
          <li key={node.id} role="treeitem" aria-expanded={has ? open : undefined} aria-level={depth + 1} aria-selected={false}>
            <NodeRow
              node={node}
              depth={depth}
              siblings={nodes.length}
              index={i}
              levels={rest.levels}
              canManage={rest.canManage}
              canDelete={rest.canDelete}
              actions={rest.actions}
              leading={
                has ? (
                  <button type="button" onClick={() => toggle(node.id)} aria-label={`${open ? "Collapse" : "Expand"} ${node.name}`} className="flex size-6 shrink-0 items-center justify-center rounded-md hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                    {open ? <ChevronDown className="size-4" aria-hidden /> : <ChevronRight className="size-4" aria-hidden />}
                  </button>
                ) : undefined
              }
            />
            {has && open ? <Branch nodes={node.children} depth={depth + 1} expanded={expanded} toggle={toggle} {...rest} /> : null}
          </li>
        );
      })}
    </ul>
  );
}

/** The whole tree, as many levels deep as the owner has made it. Items start collapsed; a row with children has an expand button. */
export function NodeTree({ nodes, levels, canManage, canDelete, actions }: { nodes: CatalogTreeNode[]; levels: CatalogLevel[]; canManage: boolean; canDelete: boolean; actions: NodeActions }) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return <Branch nodes={nodes} depth={0} expanded={expanded} toggle={toggle} levels={levels} canManage={canManage} canDelete={canDelete} actions={actions} />;
}
