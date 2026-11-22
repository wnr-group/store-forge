"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderPlus, FolderTree, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { deleteCategoryAction } from "@/app/(dashboard)/dashboard/categories/actions";
import { blankCategory, CategoryForm, type CategoryDraft } from "@/components/categories/category-form";
import type { FormState } from "@/components/shared/embedded-form";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { orderCategories } from "@/lib/categories/hierarchy";
import { useReturnFocus } from "@/lib/hooks/use-return-focus";
import { cn } from "@/lib/utils";
import type { CategoryRow } from "@/services/category.service";


export function CategoryManager({ rows, canManage, canDelete }: { rows: CategoryRow[]; canManage: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [draft, setDraft] = useState<CategoryDraft | null>(null);
  // The form reports whether it is saving, so the dialog is not closed over a save that is running.
  const saving = useRef(false);
  const onFormState = useCallback((state: FormState) => {
    saving.current = state.pending;
  }, []);
  const [toDelete, setToDelete] = useState<CategoryRow | null>(null);
  const finalFocus = useReturnFocus(draft !== null);

  const open = (r?: CategoryRow, parentId = "") => {
    setDraft(r ? { id: r.id, name: r.name, slug: r.slug, description: r.description ?? "", parentId: r.parentId ?? "" } : { ...blankCategory, parentId });
  };

  const ordered = orderCategories(rows);
  const add = canManage ? (
    <Button onClick={() => open()}>
      <Plus aria-hidden /> Add category
    </Button>
  ) : null;

  return (
    <>
      {/* The action lives in the page header (as on Team members). With no rows the empty state carries it instead, so it is never shown twice. */}
      <PageHeader title="Categories" description="Organise your catalog into a browsable taxonomy." actions={rows.length === 0 ? null : add} />
      {rows.length === 0 ? (
        <EmptyState icon={FolderTree} title="No categories yet" description="Categories organise products into a taxonomy, like Apparel, with subcategories such as Shirts inside it." action={add} />
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden md:table-cell">Handle</TableHead>
                  <TableHead className="text-right">Products</TableHead>
                  <TableHead className="w-10"><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordered.map((r) => (
                  <TableRow key={r.id} data-level={r.level}>
                    <TableCell>
                      <span className={cn("font-medium", r.level > 1 && "pl-6")}>
                        {r.level > 1 ? (
                          <span aria-hidden className="mr-1 text-muted-foreground">
                            └
                          </span>
                        ) : null}
                        {r.name}
                      </span>
                      {r.description ? <span className={cn("block max-w-sm truncate text-xs text-muted-foreground", r.level > 1 && "pl-6")}>{r.description}</span> : null}
                    </TableCell>
                    <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">{r.slug}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.productCount}</TableCell>
                    <TableCell>
                      {canManage || canDelete ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))} aria-label={`Actions for ${r.name}`}>
                            <MoreHorizontal aria-hidden />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-40">
                            {canManage && r.level === 1 ? (
                              <DropdownMenuItem onClick={() => open(undefined, r.id)}>
                                <FolderPlus aria-hidden /> Add subcategory
                              </DropdownMenuItem>
                            ) : null}
                            {canManage ? (
                              <DropdownMenuItem onClick={() => open(r)}>
                                <Pencil aria-hidden /> Edit
                              </DropdownMenuItem>
                            ) : null}
                            {canDelete ? (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem variant="destructive" onClick={() => setToDelete(r)}>
                                  <Trash2 aria-hidden /> Delete
                                </DropdownMenuItem>
                              </>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <Dialog open={draft !== null} onOpenChange={(o) => !o && !saving.current && setDraft(null)}>
        <DialogContent finalFocus={finalFocus}>
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit category" : draft?.parentId ? "New subcategory" : "New category"}</DialogTitle>
            <DialogDescription>Group products under a category, and optionally a subcategory inside it.</DialogDescription>
          </DialogHeader>
          {draft ? (
            <CategoryForm
              key={draft.id ?? `new:${draft.parentId}`}
              initial={draft}
              rows={rows}
              onStateChange={onFormState}
              onSaved={() => {
                setDraft(null);
                router.refresh();
              }}
              onCancel={() => setDraft(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete "${toDelete?.name ?? ""}"?`}
        description={`${toDelete?.productCount ? `${toDelete.productCount} product(s) will become uncategorised. ` : ""}Subcategories become top-level categories. The products themselves are kept.`}
        confirmLabel="Delete category"
        successMessage="Category deleted"
        onConfirm={async () => {
          const res = await deleteCategoryAction(toDelete?.id);
          if (res.ok) router.refresh();
          return res;
        }}
      />
    </>
  );
}
