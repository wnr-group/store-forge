"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, FileText, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deletePageAction, savePageAction } from "@/app/(dashboard)/dashboard/pages/actions";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { FormField } from "@/components/shared/form-field";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useFormErrors } from "@/lib/forms/use-form-errors";
import { pageInputSchema } from "@/lib/validations/pages";

export type PageRow = { id: string; title: string; slug: string; body: string; status: "draft" | "published"; updatedAt: string };

type Props = { pages: PageRow[]; canManage: boolean; storeUrl: string | null };

const when = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

/** Lists the store's content pages and edits them in a side sheet. Only published pages are visible on the storefront. */
export function PagesManager({ pages, canManage, storeUrl }: Props) {
  const [editing, setEditing] = useState<PageRow | "new" | null>(null);
  const [removing, setRemoving] = useState<PageRow | null>(null);
  const router = useRouter();

  const add = canManage ? (
    <Button onClick={() => setEditing("new")}>
      <Plus aria-hidden /> Add page
    </Button>
  ) : null;

  return (
    <>
      <div className="mb-4 flex justify-end">{pages.length ? add : null}</div>
      {pages.length === 0 ? (
        <EmptyState icon={FileText} title="No pages yet" description="Add pages such as About, Contact or Shipping policy. Link to them from your navigation menu." action={add} />
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-28 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pages.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.title}</TableCell>
                  <TableCell className="text-muted-foreground">/{p.slug}</TableCell>
                  <TableCell>
                    <StatusBadge tone={p.status === "published" ? "active" : "draft"}>{p.status === "published" ? "Published" : "Draft"}</StatusBadge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{when.format(new Date(p.updatedAt))}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {p.status === "published" && storeUrl ? (
                        <a href={`${storeUrl}/${p.slug}`} target="_blank" rel="noopener noreferrer" aria-label={`View ${p.title} on the storefront`} className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                          <ExternalLink className="size-4" aria-hidden />
                        </a>
                      ) : null}
                      {canManage ? (
                        <>
                          <Button variant="ghost" size="icon-sm" aria-label={`Edit ${p.title}`} onClick={() => setEditing(p)}>
                            <Pencil aria-hidden />
                          </Button>
                          <Button variant="ghost" size="icon-sm" aria-label={`Delete ${p.title}`} onClick={() => setRemoving(p)}>
                            <Trash2 aria-hidden />
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Sheet open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {editing ? <PageForm key={editing === "new" ? "new" : editing.id} page={editing === "new" ? null : editing} onDone={() => { setEditing(null); router.refresh(); }} /> : null}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Delete this page?"
        description={removing ? `"${removing.title}" will be removed from your store. Links to /${removing.slug} will show "page not found". Products and collections are not affected.` : ""}
        confirmLabel="Delete page"
        successMessage="Page deleted"
        onConfirm={async () => {
          const res = await deletePageAction(removing?.id);
          if (res.ok) router.refresh();
          return res;
        }}
      />
    </>
  );
}

function PageForm({ page, onDone }: { page: PageRow | null; onDone: () => void }) {
  const [title, setTitle] = useState(page?.title ?? "");
  const [slug, setSlug] = useState(page?.slug ?? "");
  const [body, setBody] = useState(page?.body ?? "");
  const [status, setStatus] = useState<"draft" | "published">(page?.status ?? "draft");
  const { errors, formError, pending, validate, validateField, clear, fail, submit: send } = useFormErrors();

  const payload = () => ({ title, slug, body, status });
  const blur = (field: string) => () => validateField(pageInputSchema, payload(), field);

  const submit = () => {
    if (!validate(pageInputSchema, payload())) return;
    send(async () => {
      const res = await savePageAction(page?.id ?? null, payload());
      if (!res.ok) {
        fail(res);
        return;
      }
      toast.success(page ? "Page saved" : "Page created");
      onDone();
    });
  };

  return (
    <form
      noValidate
      className="flex min-h-full flex-col gap-4 px-4 pb-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <SheetHeader className="px-0">
        <SheetTitle>{page ? "Edit page" : "Add page"}</SheetTitle>
        <SheetDescription>Pages are plain text. Only published pages are visible to your customers.</SheetDescription>
      </SheetHeader>

      {formError ? (
        <p role="alert" className="rounded-md border border-error/30 bg-error/10 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      ) : null}

      <FormField id="page-title" label="Title" required error={errors.title}>
        <Input id="page-title" value={title} maxLength={120} aria-invalid={!!errors.title} aria-describedby="page-title-msg" onChange={(e) => { setTitle(e.target.value); clear("title"); }} onBlur={blur("title")} />
      </FormField>

      <FormField id="page-slug" label="Address" optional error={errors.slug} hint={`Shown as /${slug.trim() || "about-us"}. Leave blank to make it from the title.`}>
        <Input id="page-slug" value={slug} maxLength={60} placeholder="about-us" aria-invalid={!!errors.slug} aria-describedby="page-slug-msg" onChange={(e) => { setSlug(e.target.value); clear("slug"); }} onBlur={blur("slug")} />
      </FormField>

      <FormField id="page-body" label="Content" optional error={errors.body} hint="Leave a blank line between paragraphs. Start a paragraph with # to make a heading.">
        <Textarea id="page-body" rows={12} value={body} aria-invalid={!!errors.body} aria-describedby="page-body-msg" onChange={(e) => { setBody(e.target.value); clear("body"); }} onBlur={blur("body")} />
      </FormField>

      <FormField id="page-status" label="Visibility">
        <NativeSelect id="page-status" value={status} onChange={(e) => setStatus(e.target.value as "draft" | "published")}>
          <option value="draft">Draft: hidden from customers</option>
          <option value="published">Published: visible on your store</option>
        </NativeSelect>
      </FormField>

      <div className="mt-auto flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {page ? "Save page" : "Create page"}
        </Button>
      </div>
    </form>
  );
}
