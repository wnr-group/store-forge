"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FolderPlus, FolderTree, Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteCategoryAction, saveCategoryAction } from "@/app/(dashboard)/dashboard/categories/actions";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { FormField } from "@/components/shared/form-field";
import { PageHeader } from "@/components/shared/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { orderCategories } from "@/lib/categories/hierarchy";
import { useFormErrors } from "@/lib/forms/use-form-errors";
import { useReturnFocus } from "@/lib/hooks/use-return-focus";
import { cn } from "@/lib/utils";
import { categoryInputSchema } from "@/lib/validations/catalog";
import type { CategoryRow } from "@/services/category.service";

type Draft = { id: string | null; name: string; slug: string; description: string; parentId: string };
const blank: Draft = { id: null, name: "", slug: "", description: "", parentId: "" };

export function CategoryManager({ rows, canManage, canDelete }: { rows: CategoryRow[]; canManage: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const { errors, formError, pending, validate, validateField, clear, fail, reset, submit } = useFormErrors();
  const [toDelete, setToDelete] = useState<CategoryRow | null>(null);
  const finalFocus = useReturnFocus(draft !== null);

  const payloadOf = (d: Draft) => ({ name: d.name, slug: d.slug.trim() || undefined, description: d.description, parentId: d.parentId || null });
  const change = (patch: Partial<Draft>, field: string) => {
    if (draft) setDraft({ ...draft, ...patch });
    clear(field);
  };
  const blur = (field: string) => () => draft && validateField(categoryInputSchema, payloadOf(draft), field);

  const open = (r?: CategoryRow, parentId = "") => {
    reset();
    setDraft(r ? { id: r.id, name: r.name, slug: r.slug, description: r.description ?? "", parentId: r.parentId ?? "" } : { ...blank, parentId });
  };

  const save = () => {
    if (!draft) return;
    const payload = payloadOf(draft);
    if (!validate(categoryInputSchema, payload)) return;
    submit(async () => {
      const res = await saveCategoryAction(draft.id, payload);
      if (!res.ok) {
        fail(res);
        return;
      }
      toast.success(draft.id ? "Category updated" : "Category created");
      setDraft(null);
      router.refresh();
    });
  };

  const ordered = orderCategories(rows);
  const hasChildren = draft?.id ? rows.some((r) => r.parentId === draft.id) : false;
  const parentOptions = rows.filter((r) => !r.parentId && r.id !== draft?.id);
  // An unchanged legacy parent stays selectable so saving never silently moves the category.
  const currentParent = draft?.parentId ? rows.find((r) => r.id === draft.parentId) : undefined;
  if (currentParent && !parentOptions.some((r) => r.id === currentParent.id)) parentOptions.push(currentParent);
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

      <Dialog open={draft !== null} onOpenChange={(o) => !o && !pending && setDraft(null)}>
        <DialogContent finalFocus={finalFocus}>
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit category" : draft?.parentId ? "New subcategory" : "New category"}</DialogTitle>
            <DialogDescription>Group products under a category, and optionally a subcategory inside it.</DialogDescription>
          </DialogHeader>
          {draft ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
              className="space-y-3"
              noValidate
            >
              {formError ? <p role="alert" className="text-sm text-error">{formError}</p> : null}
              <FormField id="cat-name" label="Category name" required error={errors.name}>
                <Input id="cat-name" value={draft.name} onChange={(e) => change({ name: e.target.value }, "name")} onBlur={blur("name")} aria-invalid={Boolean(errors.name)} aria-describedby="cat-name-msg" aria-required autoFocus disabled={pending} />
              </FormField>
              <FormField id="cat-slug" label="Slug" required={Boolean(draft.id)} optional={!draft.id} error={errors.slug} hint={draft.id ? "Lowercase letters, numbers and hyphens." : "Leave blank to generate it from the name."}>
                <Input id="cat-slug" value={draft.slug} onChange={(e) => change({ slug: e.target.value }, "slug")} onBlur={blur("slug")} aria-invalid={Boolean(errors.slug)} aria-describedby="cat-slug-msg" disabled={pending} />
              </FormField>
              <FormField id="cat-parent" label="Parent category" optional error={errors.parentId} hint={hasChildren ? "This category has subcategories, so it cannot become a subcategory." : "Leave empty for a top-level category."}>
                <NativeSelect id="cat-parent" value={draft.parentId} onChange={(e) => change({ parentId: e.target.value }, "parentId")} aria-invalid={Boolean(errors.parentId)} aria-describedby="cat-parent-msg" disabled={pending || hasChildren}>
                  <option value="">None (top level)</option>
                  {parentOptions.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </NativeSelect>
              </FormField>
              <FormField id="cat-desc" label="Description" optional error={errors.description}>
                <Textarea id="cat-desc" rows={3} value={draft.description} onChange={(e) => change({ description: e.target.value }, "description")} onBlur={blur("description")} aria-invalid={Boolean(errors.description)} aria-describedby="cat-desc-msg" disabled={pending} />
              </FormField>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDraft(null)} disabled={pending}>Cancel</Button>
                <Button type="submit" disabled={pending}>
                  {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} {pending ? "Saving…" : "Save"}
                </Button>
              </DialogFooter>
            </form>
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
