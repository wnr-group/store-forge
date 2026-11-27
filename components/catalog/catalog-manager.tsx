"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Eye, EyeOff, FolderTree, Loader2, PackagePlus, Pencil, Plus, Search, Upload } from "lucide-react";
import { toast } from "sonner";
import { createHierarchyAction, deleteNodeAction, reorderNodesAction, updateHierarchyAction } from "@/app/(dashboard)/dashboard/catalog/actions";
import { BulkAssignDialog } from "@/components/catalog/bulk-assign-dialog";
import { LevelsEditor } from "@/components/catalog/levels-editor";
import { MoveNodeDialog, NodeFormDialog } from "@/components/catalog/node-dialogs";
import { NodeProductsSheet } from "@/components/catalog/node-products-sheet";
import { NodeSearchResults } from "@/components/catalog/node-search";
import { NodeTree, type NodeActions } from "@/components/catalog/node-tree";
import { ActionDialog } from "@/components/shared/action-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { FormField } from "@/components/shared/form-field";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ROUTES } from "@/config/app";
import { childrenOf, productHolders, shiftId } from "@/lib/catalog/tree";
import type { CatalogHierarchy, CatalogNode, CatalogTreeNode } from "@/lib/catalog/types";
import { cn } from "@/lib/utils";

type NodeDialog = { mode: "create"; parent: CatalogNode | null } | { mode: "edit"; node: CatalogNode };

/**
 * The catalog hierarchy dashboard: set the catalog up, define its levels, build the tree of items and place products on them.
 * Everything shown (level names, how many levels, which levels carry products) is the owner's own data from the API.
 */
export function CatalogManager({ hierarchy, tree, truncated, canManage, canDelete, currency }: { hierarchy: CatalogHierarchy | null; tree: CatalogTreeNode[]; truncated: boolean; canManage: boolean; canDelete: boolean; currency: string }) {
  const router = useRouter();
  const [nodeDialog, setNodeDialog] = useState<NodeDialog | null>(null);
  const [moving, setMoving] = useState<CatalogNode | null>(null);
  const [deleting, setDeleting] = useState<CatalogNode | null>(null);
  const [productsOf, setProductsOf] = useState<CatalogNode | null>(null);
  const [bulk, setBulk] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [pending, startTransition] = useTransition();

  const levels = useMemo(() => hierarchy?.levels ?? [], [hierarchy]);
  const holders = useMemo(() => productHolders(tree, levels), [tree, levels]);

  if (!hierarchy) {
    return (
      <>
        <PageHeader title="Catalog hierarchy" description="Let shoppers browse your products through levels you define, such as Category → Subcategory → Item." />
        <EmptyState
          icon={FolderTree}
          title="Set up your catalog hierarchy"
          description="You choose the levels and what they are called. Products are placed on items, and the same product can sit on many items without being copied."
          action={
            canManage ? (
              <div className="flex flex-wrap justify-center gap-2">
                <Button type="button" onClick={() => { setName("Catalog"); setRenaming(true); }}>
                  <Plus aria-hidden /> Set up catalog
                </Button>
                <Link href={ROUTES.catalogImport} className={buttonVariants({ variant: "outline" })}>
                  <Upload aria-hidden /> Import from a file
                </Link>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Ask the store owner to set it up.</p>
            )
          }
        />
        {renaming ? (
          <ActionDialog open onOpenChange={(o) => !o && setRenaming(false)} title="Set up your catalog" description="It starts as a draft: shoppers see nothing until you make it active." submitLabel="Create catalog" success="Catalog created" onSubmit={() => createHierarchyAction({ name })}>
            <FormField id="hierarchy-name" label="Catalog name" required hint="Only you see this name.">
              <Input id="hierarchy-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus />
            </FormField>
          </ActionDialog>
        ) : null}
      </>
    );
  }

  const active = hierarchy.status === "active";
  const topLevel = levels[0] ?? null;

  const actions: NodeActions = {
    onAddChild: (n) => setNodeDialog({ mode: "create", parent: n }),
    onEdit: (n) => setNodeDialog({ mode: "edit", node: n }),
    onMove: (n) => setMoving(n),
    onDelete: (n) => setDeleting(n),
    onProducts: (n) => setProductsOf(n),
    onShift: (n, direction) =>
      startTransition(async () => {
        const ids = childrenOf(tree, n.parentId).map((c) => c.id);
        const res = await reorderNodesAction(n.parentId, shiftId(ids, n.id, direction));
        if (res.ok) router.refresh();
        else toast.error(res.error);
      }),
  };

  const setStatus = () =>
    startTransition(async () => {
      const res = await updateHierarchyAction({ status: active ? "draft" : "active" });
      if (res.ok) {
        toast.success(active ? "The catalog is hidden from shoppers" : "The catalog is live");
        router.refresh();
      } else toast.error(res.error);
    });

  const addLevelFor = (parent: CatalogNode | null) => levels.find((l) => l.position === (parent ? parent.levelPosition + 1 : 1)) ?? null;
  const dialogLevel = nodeDialog ? (nodeDialog.mode === "create" ? addLevelFor(nodeDialog.parent) : (levels.find((l) => l.id === nodeDialog.node.levelId) ?? null)) : null;

  return (
    <>
      <PageHeader
        title={hierarchy.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            Catalog hierarchy · {levels.length} {levels.length === 1 ? "level" : "levels"} · {hierarchy.nodeCount} {hierarchy.nodeCount === 1 ? "item" : "items"}
            <StatusBadge tone={active ? "active" : "draft"}>{active ? "Live" : "Draft"}</StatusBadge>
          </span>
        }
        actions={
          <>
            {canManage ? (
              <>
                <Button type="button" variant="outline" onClick={setStatus} disabled={pending}>
                  {pending ? <Loader2 className="animate-spin" aria-hidden /> : active ? <EyeOff aria-hidden /> : <Eye aria-hidden />} {active ? "Hide from shoppers" : "Make live"}
                </Button>
                <Button type="button" variant="outline" onClick={() => { setName(hierarchy.name); setRenaming(true); }}>
                  <Pencil aria-hidden /> Rename
                </Button>
                <Button type="button" variant="outline" onClick={() => setBulk(true)} disabled={holders.length === 0}>
                  <PackagePlus aria-hidden /> Bulk assign
                </Button>
              </>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger className={cn(buttonVariants({ variant: "outline" }))}>
                <Download aria-hidden /> Import &amp; export
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-52">
                {canManage ? (
                  <DropdownMenuItem render={<Link href={ROUTES.catalogImport} />}>
                    <Upload aria-hidden /> Import from a file
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem render={<a href={`${ROUTES.catalog}/export?format=xlsx`} download />}>
                  <Download aria-hidden /> Export catalog (Excel)
                </DropdownMenuItem>
                <DropdownMenuItem render={<a href={`${ROUTES.catalog}/export?format=csv`} download />}>
                  <Download aria-hidden /> Export items (CSV)
                </DropdownMenuItem>
                <DropdownMenuItem render={<a href={`${ROUTES.catalog}/export?format=csv&part=levels`} download />}>
                  <Download aria-hidden /> Export levels (CSV)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      {!active ? (
        <p role="note" className="mb-4 rounded-md border border-warning/35 bg-warning/10 px-3 py-2 text-sm text-warning-text">
          This catalog is a draft, so shoppers see nothing of it. Items must be active too. Make it live when it is ready.
        </p>
      ) : null}

      <div className="space-y-4">
        <LevelsEditor levels={levels} canManage={canManage} canDelete={canDelete} />

        <SectionCard
          title="Items"
          description="Build the tree below the levels. A new item goes on the level right after its parent. Open an item's menu to add, edit, move, reorder or delete it, or to manage its products."
        >
          {levels.length === 0 ? (
            <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">Add a level first, then you can add items to it.</p>
          ) : (
            <>
              {canManage && topLevel ? (
                <Button type="button" size="sm" className="w-full" onClick={() => setNodeDialog({ mode: "create", parent: null })}>
                  <Plus aria-hidden /> Add {topLevel.name.toLowerCase()}
                </Button>
              ) : null}
              <form
                role="search"
                className="relative"
                onSubmit={(e) => {
                  e.preventDefault();
                  setTerm(search.trim());
                }}
              >
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  aria-label="Search items by name or address"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    if (e.target.value.trim() === "") setTerm("");
                  }}
                  placeholder="Search items by name or address, then press Enter"
                  className="pl-8"
                />
              </form>
              {term ? (
                <NodeSearchResults key={term} term={term} levels={levels} canManage={canManage} canDelete={canDelete} actions={actions} />
              ) : tree.length === 0 ? (
                <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">No items yet.{topLevel ? ` Add the first ${topLevel.name.toLowerCase()}.` : ""}</p>
              ) : (
                <>
                  {truncated ? <p className="text-xs text-warning-text">The tree is very large, so only the first 5000 items are shown. Use search to find the rest.</p> : null}
                  <NodeTree nodes={tree} levels={levels} canManage={canManage} canDelete={canDelete} actions={actions} />
                </>
              )}
            </>
          )}
        </SectionCard>
      </div>

      {nodeDialog ? <NodeFormDialog key={nodeDialog.mode === "edit" ? nodeDialog.node.id : `new:${nodeDialog.parent?.id ?? "top"}`} target={nodeDialog} level={dialogLevel} onClose={() => setNodeDialog(null)} /> : null}
      {moving ? <MoveNodeDialog node={moving} levels={levels} onClose={() => setMoving(null)} /> : null}
      {productsOf ? <NodeProductsSheet node={productsOf} canHold={levels.find((l) => l.id === productsOf.levelId)?.canHoldProducts ?? false} canManage={canManage} currency={currency} onClose={() => setProductsOf(null)} /> : null}
      {bulk ? <BulkAssignDialog holders={holders} onClose={() => setBulk(false)} /> : null}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete “${deleting?.name ?? ""}”?`}
        description={
          deleting && deleting.childCount > 0
            ? `This also deletes the ${deleting.childCount} ${deleting.childCount === 1 ? "item" : "items"} directly below it, and everything under those. Products are never deleted, only taken off the deleted items.`
            : "Products placed on it are not deleted, only taken off. This cannot be undone."
        }
        confirmLabel="Delete"
        confirmPhrase={deleting && deleting.childCount > 0 ? deleting.name : undefined}
        successMessage="Item deleted"
        onConfirm={async () => {
          const res = await deleteNodeAction(deleting?.id, (deleting?.childCount ?? 0) > 0);
          if (res.ok) router.refresh();
          return res;
        }}
      />

      {renaming ? (
        <ActionDialog open onOpenChange={(o) => !o && setRenaming(false)} title="Rename the catalog" submitLabel="Save" success="Saved" onSubmit={() => updateHierarchyAction({ name })}>
          <FormField id="hierarchy-name" label="Catalog name" required>
            <Input id="hierarchy-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus />
          </FormField>
        </ActionDialog>
      ) : null}
    </>
  );
}
