"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FolderTree, Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteCategoryAction, saveCategoryAction } from "@/app/(dashboard)/dashboard/categories/actions";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { FormField } from "@/components/shared/form-field";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { categoryInputSchema } from "@/lib/validations/catalog";
import type { CategoryRow } from "@/services/category.service";

type Draft = { id: string | null; name: string; slug: string; description: string; parentId: string };
const blank: Draft = { id: null, name: "", slug: "", description: "", parentId: "" };

/** Ids of `id` and everything below it: these cannot be chosen as its parent. */
function descendants(rows: CategoryRow[], id: string): Set<string> {
  const out = new Set([id]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const r of rows) {
      if (r.parentId && out.has(r.parentId) && !out.has(r.id)) {
        out.add(r.id);
        grew = true;
      }
    }
  }
  return out;
}

export function CategoryManager({ rows, canManage, canDelete }: { rows: CategoryRow[]; canManage: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<CategoryRow | null>(null);
  const [pending, startTransition] = useTransition();

  const open = (r?: CategoryRow) => {
    setErrors({});
    setFormError(null);
    setDraft(r ? { id: r.id, name: r.name, slug: r.slug, description: r.description ?? "", parentId: r.parentId ?? "" } : blank);
  };

  const save = () => {
    if (!draft) return;
    const payload = { name: draft.name, slug: draft.slug.trim() || undefined, description: draft.description, parentId: draft.parentId || null };
    const parsed = categoryInputSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])));
      return;
    }
    startTransition(async () => {
      const res = await saveCategoryAction(draft.id, payload);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        setFormError(res.error);
        return;
      }
      toast.success(draft.id ? "Category updated" : "Category created");
      setDraft(null);
      router.refresh();
    });
  };

  const blocked = draft?.id ? descendants(rows, draft.id) : new Set<string>();
  const add = canManage ? (
    <Button onClick={() => open()}>
      <Plus aria-hidden /> Add category
    </Button>
  ) : null;

  return (
    <>
      {rows.length === 0 ? (
        <EmptyState icon={FolderTree} title="No categories yet" description="Categories organise products into a taxonomy, like Apparel › Shirts." action={add} />
      ) : (
        <>
          {add ? <div className="mb-4 flex justify-end">{add}</div> : null}
          <div className="overflow-hidden rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Parent</TableHead>
                  <TableHead className="hidden md:table-cell">Handle</TableHead>
                  <TableHead className="text-right">Products</TableHead>
                  <TableHead className="w-10"><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <span className="font-medium">{r.name}</span>
                      {r.description ? <span className="block max-w-sm truncate text-xs text-muted-foreground">{r.description}</span> : null}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">{r.parentName ?? "—"}</TableCell>
                    <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">{r.slug}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.productCount}</TableCell>
                    <TableCell>
                      {canManage || canDelete ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))} aria-label={`Actions for ${r.name}`}>
                            <MoreHorizontal aria-hidden />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-40">
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit category" : "New category"}</DialogTitle>
            <DialogDescription>Products can belong to one category. Nest categories with a parent.</DialogDescription>
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
              {formError ? <p role="alert" className="text-sm text-destructive">{formError}</p> : null}
              <FormField id="cat-name" label="Name" error={errors.name}>
                <Input id="cat-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} aria-invalid={Boolean(errors.name)} aria-describedby="cat-name-msg" autoFocus />
              </FormField>
              <FormField id="cat-slug" label="URL handle" error={errors.slug} hint={draft.id ? undefined : "Leave blank to generate from the name."}>
                <Input id="cat-slug" value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} aria-invalid={Boolean(errors.slug)} aria-describedby="cat-slug-msg" />
              </FormField>
              <FormField id="cat-parent" label="Parent category" error={errors.parentId}>
                <NativeSelect id="cat-parent" value={draft.parentId} onChange={(e) => setDraft({ ...draft, parentId: e.target.value })}>
                  <option value="">None (top level)</option>
                  {rows.filter((r) => !blocked.has(r.id)).map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </NativeSelect>
              </FormField>
              <FormField id="cat-desc" label="Description" error={errors.description}>
                <Textarea id="cat-desc" rows={3} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} aria-describedby="cat-desc-msg" />
              </FormField>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDraft(null)} disabled={pending}>Cancel</Button>
                <Button type="submit" disabled={pending}>
                  {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} Save
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
        description={`${toDelete?.productCount ? `${toDelete.productCount} product(s) will become uncategorised. ` : ""}Sub-categories become top-level. The products themselves are kept.`}
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
