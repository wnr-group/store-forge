"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteCollectionAction, saveCollectionAction } from "@/app/(dashboard)/dashboard/collections/actions";
import { ImageUploader, type ImageItem } from "@/components/products/image-uploader";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormField } from "@/components/shared/form-field";
import { SectionCard } from "@/components/shared/section-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { ROUTES } from "@/config/app";
import { useFormErrors } from "@/lib/forms/use-form-errors";
import { cn } from "@/lib/utils";
import { uuid } from "@/lib/utils/uuid";
import { collectionInputSchema } from "@/lib/validations/catalog";
import type { Collection } from "@/lib/db/schema";

type Props = {
  mode: "create" | "edit";
  initial?: Collection & { productIds: string[] };
  products: { id: string; name: string }[];
  canDelete: boolean;
};

export function CollectionForm({ mode, initial, products, canDelete }: Props) {
  const router = useRouter();
  const [id] = useState(() => initial?.id ?? uuid());
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [status, setStatus] = useState<"draft" | "active">(initial?.status ?? "draft");
  const [picked, setPicked] = useState<string[]>(initial?.productIds ?? []);
  const [filter, setFilter] = useState("");
  const [image, setImage] = useState<ImageItem[]>(
    initial?.imagePath ? [{ key: "existing", path: initial.imagePath, altText: null, progress: 100, status: "done", saved: true }] : [],
  );
  const { errors, formError, pending, validate, validateField, clear, fail, submit: send } = useFormErrors();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const visible = useMemo(() => products.filter((p) => p.name.toLowerCase().includes(filter.trim().toLowerCase())), [products, filter]);
  const uploading = image.some((i) => i.status === "uploading");

  const buildPayload = () => {
    const done = image.find((i) => i.status === "done" && i.path);
    return { name, slug: slug.trim() || undefined, description, status, imagePath: done?.path ?? null, productIds: picked };
  };
  const blur = (field: string) => () => validateField(collectionInputSchema, buildPayload(), field);

  const submit = () => {
    const payload = buildPayload();
    if (!validate(collectionInputSchema, payload)) return;
    if (image.some((i) => i.status === "error")) {
      fail({ ok: false, error: "Remove the image that failed to upload, or upload it again." });
      return;
    }
    send(async () => {
      const res = await saveCollectionAction(mode, id, payload);
      if (!res.ok) {
        fail(res);
        return;
      }
      toast.success(mode === "create" ? "Collection created" : "Changes saved");
      if (mode === "create") router.replace(`${ROUTES.collections}/${id}`);
      else router.refresh();
    });
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {formError ? <div role="alert" className="mb-4 rounded-lg border border-error/30 bg-error/5 px-3 py-2 text-sm text-error">{formError}</div> : null}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          <SectionCard title="Details">
            <FormField id="col-name" label="Collection name" required error={errors.name}>
              <Input id="col-name" value={name} onChange={(e) => { setName(e.target.value); clear("name"); }} onBlur={blur("name")} aria-invalid={Boolean(errors.name)} aria-describedby="col-name-msg" aria-required disabled={pending} autoFocus={mode === "create"} />
            </FormField>
            <FormField id="col-slug" label="Slug" required={mode === "edit"} optional={mode === "create"} error={errors.slug} hint={mode === "create" ? "Leave blank to generate it from the name." : "Lowercase letters, numbers and hyphens."}>
              <Input id="col-slug" value={slug} onChange={(e) => { setSlug(e.target.value); clear("slug"); }} onBlur={blur("slug")} aria-invalid={Boolean(errors.slug)} aria-describedby="col-slug-msg" disabled={pending} />
            </FormField>
            <FormField id="col-desc" label="Description" optional error={errors.description}>
              <Textarea id="col-desc" rows={4} value={description} onChange={(e) => { setDescription(e.target.value); clear("description"); }} onBlur={blur("description")} aria-invalid={Boolean(errors.description)} aria-describedby="col-desc-msg" disabled={pending} />
            </FormField>
          </SectionCard>

          <SectionCard title="Products" description="Choose which products appear in this collection.">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter products" aria-label="Filter products" className="pl-8" />
            </div>
            {errors.productIds ? <p role="alert" className="text-xs text-error">{errors.productIds}</p> : null}
            {products.length === 0 ? (
              <p className="text-sm text-muted-foreground">No products yet. <Link href={`${ROUTES.products}/new`} className="text-link underline underline-offset-2">Add one</Link> first.</p>
            ) : (
              <ul className="max-h-72 divide-y overflow-y-auto rounded-lg border">
                {visible.map((p) => (
                  <li key={p.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50">
                      <Checkbox checked={picked.includes(p.id)} onCheckedChange={(on) => setPicked((cur) => (on === true ? [...cur, p.id] : cur.filter((x) => x !== p.id)))} disabled={pending} />
                      <span className="truncate">{p.name}</span>
                    </label>
                  </li>
                ))}
                {visible.length === 0 ? <li className="px-3 py-4 text-center text-sm text-muted-foreground">No matches</li> : null}
              </ul>
            )}
            <p className="text-xs text-muted-foreground">{picked.length} selected</p>
          </SectionCard>
        </div>

        <div className="space-y-4">
          <SectionCard title="Status">
            <FormField id="col-status" label="Visibility" hint={status === "active" ? "Visible on your storefront." : "Hidden from your storefront."}>
              <NativeSelect id="col-status" value={status} onChange={(e) => setStatus(e.target.value as "draft" | "active")} disabled={pending}>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
              </NativeSelect>
            </FormField>
          </SectionCard>
          <SectionCard title="Image">
            <ImageUploader value={image} onChange={setImage} scope="collection" ownerId={id} max={1} single disabled={pending} label="Collection image" />
          </SectionCard>
          {mode === "edit" && canDelete ? (
            <Button type="button" variant="outline" className="w-full text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)} disabled={pending}>
              <Trash2 aria-hidden /> Delete collection
            </Button>
          ) : null}
        </div>
      </div>

      <div className="sticky bottom-0 z-20 -mx-3 mt-6 border-t bg-background sm:-mx-6">
        <div className="flex items-center justify-end gap-2 px-3 py-3 sm:px-6">
          <Link href={ROUTES.collections} className={cn(buttonVariants({ variant: "outline" }), "h-9")}>{mode === "create" ? "Cancel" : "Back"}</Link>
          <Button type="submit" className="h-9" disabled={pending || uploading}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {pending ? "Saving…" : mode === "create" ? "Create collection" : "Save changes"}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete "${initial?.name ?? "collection"}"?`}
        description="The collection and its image are removed. The products in it are kept."
        confirmLabel="Delete collection"
        onConfirm={async () => {
          const res = await deleteCollectionAction(id);
          if (res.ok) {
            toast.success("Collection deleted");
            router.replace(ROUTES.collections);
          }
          return res;
        }}
      />
    </form>
  );
}
