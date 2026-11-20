"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { getProductQuickEditAction, quickEditProductAction } from "@/app/(dashboard)/dashboard/products/actions";
import { ImageUploader, type ImageItem } from "@/components/products/image-uploader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ROUTES } from "@/config/app";
import type { QuickEditProduct } from "@/services/product.service";

/** The product a card shows: its address and name, which is all the card carries. */
export type CardProductRef = { slug: string; name: string };

/** Which field the merchant came for, so it is focused when the form opens. */
export type QuickEditField = "name" | "shortDescription" | "price" | "image";

/**
 * Edit the product behind a card, from the card: name, short description, price, compare-at price and the main picture. It saves
 * the real product (the same record the Products page edits), so the change shows everywhere the product is listed.
 */
export function ProductQuickEdit({ target, field, canEdit, onClose, onSaved }: { target: CardProductRef | null; field: QuickEditField; canEdit: boolean; onClose: () => void; onSaved: (product: QuickEditProduct) => void }) {
  const query = useQuery({
    queryKey: ["quick-edit-product", target?.slug],
    enabled: Boolean(target),
    // Always the product as it is now: another tab or the Products page may have changed it.
    gcTime: 0,
    staleTime: 0,
    queryFn: async () => {
      const result = await getProductQuickEditAction({ slug: target!.slug, name: target!.name });
      if (!result.ok) throw new Error(result.error);
      return result.data!;
    },
  });

  return (
    <Dialog open={Boolean(target)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit product</DialogTitle>
          <DialogDescription>Changes are saved to the product itself and show everywhere it is listed.</DialogDescription>
        </DialogHeader>
        {query.isPending ? (
          <div className="flex h-40 items-center justify-center text-muted-foreground"><Loader2 className="size-5 animate-spin" aria-label="Loading product" /></div>
        ) : query.isError ? (
          <Alert variant="destructive">
            <AlertDescription className="flex items-center justify-between gap-2">
              {query.error.message}
              <Button size="xs" variant="outline" onClick={() => void query.refetch()}>Try again</Button>
            </AlertDescription>
          </Alert>
        ) : (
          <QuickEditForm key={query.data.id} product={query.data} field={field} canEdit={canEdit} onClose={onClose} onSaved={onSaved} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function QuickEditForm({ product, field, canEdit, onClose, onSaved }: { product: QuickEditProduct; field: QuickEditField; canEdit: boolean; onClose: () => void; onSaved: (product: QuickEditProduct) => void }) {
  const [name, setName] = useState(product.name);
  const [shortDescription, setShortDescription] = useState(product.shortDescription);
  const [price, setPrice] = useState(product.price);
  const [compareAtPrice, setCompareAtPrice] = useState(product.compareAtPrice);
  const [images, setImages] = useState<ImageItem[]>(
    product.imagePath ? [{ key: "current", path: product.imagePath, altText: product.name, progress: 100, status: "done", saved: true }] : [],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploading = images.some((i) => i.status === "uploading");
  const failed = images.some((i) => i.status === "error");
  const newPath = images[0]?.status === "done" && images[0].path !== product.imagePath ? images[0].path : null;
  const changed = name !== product.name || shortDescription !== product.shortDescription || price !== product.price || compareAtPrice !== product.compareAtPrice || newPath !== null;
  const disabled = !canEdit || saving;

  async function save() {
    if (failed) return setError("Remove the picture that failed to upload, or upload it again.");
    if (!name.trim()) return setError("Enter a product name.");
    setSaving(true);
    setError(null);
    try {
      const result = await quickEditProductAction({ id: product.id, name, shortDescription, price, compareAtPrice, imagePath: newPath });
      if (!result.ok) {
        // The first field message is the most useful one; otherwise the general one.
        setError(Object.values(result.fieldErrors ?? {})[0] ?? result.error);
        return;
      }
      toast.success("Product updated", { description: result.data!.name });
      onSaved(result.data!);
      onClose();
    } catch {
      setError("Could not save the product. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="qe-name" className="text-xs font-medium">Product name</Label>
        <Input id="qe-name" value={name} maxLength={200} disabled={disabled} autoFocus={field === "name"} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="qe-short" className="text-xs font-medium">Short description</Label>
        <Textarea id="qe-short" value={shortDescription} rows={2} maxLength={300} disabled={disabled} autoFocus={field === "shortDescription"} onChange={(e) => setShortDescription(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="qe-price" className="text-xs font-medium">Price ({product.currency})</Label>
          <Input id="qe-price" value={price} inputMode="decimal" disabled={disabled || product.hasVariants} autoFocus={field === "price" && !product.hasVariants} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="qe-compare" className="text-xs font-medium">Compare-at price</Label>
          <Input id="qe-compare" value={compareAtPrice} inputMode="decimal" placeholder="Optional" disabled={disabled || product.hasVariants} onChange={(e) => setCompareAtPrice(e.target.value)} />
        </div>
      </div>
      {product.hasVariants ? (
        <p className="-mt-2 text-xs text-muted-foreground">
          This product has variants, each with its own price.{" "}
          <Link href={`${ROUTES.products}/${product.id}`} target="_blank" className="inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-2">
            Edit prices on the product page <ExternalLink className="size-3" aria-hidden />
          </Link>
        </p>
      ) : null}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Main picture</Label>
        <ImageUploader value={images} onChange={setImages} scope="product" ownerId={product.id} max={1} single disabled={disabled} />
        <p className="text-xs text-muted-foreground">Upload a new picture to replace the main one. The product&apos;s other pictures stay.</p>
      </div>
      {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
      {!canEdit ? <p className="text-xs text-muted-foreground">You can look but not change anything. Editing needs access to the catalogue.</p> : null}
      <DialogFooter className="items-center sm:justify-between">
        <Link href={`${ROUTES.products}/${product.id}`} target="_blank" className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
          Full product page <ExternalLink className="size-3" aria-hidden />
        </Link>
        <span className="flex gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={disabled || uploading || !changed}>
            {saving ? <Loader2 className="animate-spin" aria-hidden /> : null} Save
          </Button>
        </span>
      </DialogFooter>
    </form>
  );
}
