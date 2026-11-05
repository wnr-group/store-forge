"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { createProductAction, deleteProductsAction, updateProductAction } from "@/app/(dashboard)/dashboard/products/actions";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormField } from "@/components/shared/form-field";
import { SectionCard } from "@/components/shared/section-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ROUTES } from "@/config/app";
import { minorToInput } from "@/lib/money";
import { useFormErrors } from "@/lib/forms/use-form-errors";
import { cn } from "@/lib/utils";
import { MAX_IMAGES_PER_PRODUCT, productInputSchema } from "@/lib/validations/catalog";
import type { ProductDetail } from "@/services/product.service";
import { ImageUploader, type ImageItem } from "./image-uploader";
import { VariantsEditor, type OptionDraft, type VariantDraft } from "./variants-editor";

type Values = {
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  productType: string;
  categoryId: string;
  collectionIds: string[];
  sku: string;
  price: string;
  compareAtPrice: string;
  cost: string;
  trackInventory: boolean;
  quantity: string;
  lowStockThreshold: string;
  status: "draft" | "active";
  options: OptionDraft[];
  variants: VariantDraft[];
  images: ImageItem[];
};

type Props = {
  mode: "create" | "edit";
  currency: string;
  categories: { id: string; label: string }[];
  collections: { id: string; name: string }[];
  initial?: ProductDetail;
  canDelete: boolean;
};

function toValues(currency: string, d?: ProductDetail): Values {
  if (!d) {
    return { name: "", slug: "", shortDescription: "", description: "", productType: "", categoryId: "", collectionIds: [], sku: "", price: "", compareAtPrice: "", cost: "", trackInventory: true, quantity: "0", lowStockThreshold: "5", status: "draft", options: [], variants: [], images: [] };
  }
  const p = d.product;
  const pathById = new Map(d.images.map((i) => [i.id, i.storagePath]));
  return {
    name: p.name,
    slug: p.slug,
    shortDescription: p.shortDescription ?? "",
    description: p.description ?? "",
    productType: p.productType ?? "",
    categoryId: p.categoryId ?? "",
    collectionIds: d.collectionIds,
    sku: p.sku ?? "",
    price: minorToInput(p.priceMinor, currency),
    compareAtPrice: minorToInput(p.compareAtPriceMinor, currency),
    cost: minorToInput(p.costMinor, currency),
    trackInventory: p.trackInventory,
    quantity: String(p.quantity),
    lowStockThreshold: String(p.lowStockThreshold),
    status: p.status,
    options: d.options.map((o) => ({ name: o.name, values: o.values })),
    variants: d.variants.map((v) => ({
      id: v.id,
      options: v.options,
      sku: v.sku ?? "",
      price: minorToInput(v.priceMinor, currency),
      compareAtPrice: minorToInput(v.compareAtPriceMinor, currency),
      quantity: v.quantity,
      imagePath: v.imageId ? (pathById.get(v.imageId) ?? null) : null,
      isActive: v.isActive,
    })),
    images: d.images.map((i) => ({ key: i.id, path: i.storagePath, altText: i.altText, progress: 100, status: "done" as const, saved: true })),
  };
}

export function ProductForm({ mode, currency, categories, collections, initial, canDelete }: Props) {
  const router = useRouter();
  const [productId] = useState(() => initial?.product.id ?? crypto.randomUUID());
  const defaults = useMemo(() => toValues(currency, initial), [currency, initial]);
  const { register, control, setValue, getValues } = useForm<Values>({ defaultValues: defaults });
  const { errors, formError, setFormError, pending, validate, validateField, clear, fail, submit: send } = useFormErrors();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const v = useWatch({ control }) as Values;
  const hasVariants = v.variants.length > 0 || v.options.length > 0;
  const uploading = v.images.some((i) => i.status === "uploading");
  const imagePaths = v.images.flatMap((i) => (i.status === "done" && i.path ? [i.path] : []));
  const err = (k: string) => errors[k];
  const slugTouched = Boolean(v.slug) || mode === "edit";
  const symbol = useMemo(() => new Intl.NumberFormat("en", { style: "currency", currency, currencyDisplay: "narrowSymbol" }).formatToParts(0).find((p) => p.type === "currency")?.value ?? currency, [currency]);

  function buildPayload() {
    const values = getValues();
    return {
      id: productId,
      name: values.name,
      slug: values.slug.trim() || undefined,
      description: values.description,
      shortDescription: values.shortDescription,
      productType: values.productType,
      categoryId: values.categoryId || null,
      collectionIds: values.collectionIds,
      sku: values.sku,
      price: values.price,
      compareAtPrice: values.compareAtPrice,
      cost: values.cost,
      trackInventory: values.trackInventory,
      quantity: values.quantity,
      lowStockThreshold: values.lowStockThreshold,
      status: values.status,
      options: values.options,
      variants: values.variants.map((x) => ({ ...x, quantity: x.quantity })),
      images: values.images.filter((i) => i.status === "done" && i.path).map((i) => ({ path: i.path!, altText: i.altText ?? "" })),
    };
  }

  /** register() wired for blur validation and clear-on-edit. */
  const reg = (name: keyof Values) =>
    register(name, {
      onChange: () => clear(name),
      onBlur: () => validateField(productInputSchema, buildPayload(), name),
    });

  function submit() {
    const payload = buildPayload();
    // Same schema as the server: immediate feedback, and the server re-validates regardless.
    if (!validate(productInputSchema, payload)) return;
    if (getValues("images").some((i) => i.status === "error")) {
      setFormError("Remove the images that failed to upload, or upload them again.");
      return;
    }
    send(async () => {
      const result = await (mode === "create" ? createProductAction(payload) : updateProductAction(payload));
      if (!result.ok) {
        fail(result);
        return;
      }
      toast.success(mode === "create" ? "Product created" : "Changes saved");
      setValue("images", getValues("images").map((i) => ({ ...i, saved: i.status === "done" })));
      if (mode === "create") router.replace(`${ROUTES.products}/${productId}`);
      else router.refresh();
    });
  }

  const disabled = pending;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      noValidate
    >
      {formError ? (
        <div role="alert" className="mb-4 rounded-lg border border-error/30 bg-error/5 px-3 py-2 text-sm text-error">
          {formError}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          <SectionCard title="Basic information">
            <FormField id="name" label="Product name" required error={err("name")}>
              <Input id="name" {...reg("name")} aria-invalid={Boolean(err("name"))} aria-describedby="name-msg" aria-required placeholder="e.g. Classic cotton tee" disabled={disabled} autoFocus={mode === "create"} />
            </FormField>
            <FormField id="shortDescription" label="Short description" optional error={err("shortDescription")} hint="One line shown in listings.">
              <Input id="shortDescription" {...reg("shortDescription")} aria-invalid={Boolean(err("shortDescription"))} aria-describedby="shortDescription-msg" disabled={disabled} />
            </FormField>
            <FormField id="slug" label="Slug" optional error={err("slug")} hint={slugTouched ? "Used in the product URL. Lowercase letters, numbers and hyphens." : "Leave blank to generate it from the name."}>
              <Input id="slug" {...reg("slug")} aria-invalid={Boolean(err("slug"))} aria-describedby="slug-msg" placeholder="classic-cotton-tee" disabled={disabled} />
            </FormField>
          </SectionCard>

          <SectionCard title="Description">
            <FormField id="description" label="Description" optional error={err("description")}>
              <Textarea id="description" rows={6} {...reg("description")} aria-invalid={Boolean(err("description"))} aria-describedby="description-msg" disabled={disabled} />
            </FormField>
          </SectionCard>

          <SectionCard title="Media" description={`Up to ${MAX_IMAGES_PER_PRODUCT} images. The first image is the main one.`}>
            <ImageUploader
              value={v.images}
              onChange={(next) => setValue("images", typeof next === "function" ? next(getValues("images")) : next, { shouldDirty: true })}
              scope="product"
              ownerId={productId}
              max={MAX_IMAGES_PER_PRODUCT}
              disabled={disabled}
            />
          </SectionCard>

          <SectionCard title="Pricing" description={`Amounts in ${currency}.`}>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField id="price" label={hasVariants ? "Base price" : "Product price"} required error={err("price")} hint={hasVariants ? "Variants set their own prices." : undefined}>
                <MoneyInput id="price" symbol={symbol} aria-required {...reg("price")} invalid={Boolean(err("price"))} disabled={disabled} />
              </FormField>
              <FormField id="compareAtPrice" label="Compare-at price" optional error={err("compareAtPrice")} hint="Original price, shown struck through. Must be higher than the price.">
                <MoneyInput id="compareAtPrice" symbol={symbol} {...reg("compareAtPrice")} invalid={Boolean(err("compareAtPrice"))} disabled={disabled} />
              </FormField>
              <FormField id="cost" label="Cost per item" optional error={err("cost")} hint="Only you see this.">
                <MoneyInput id="cost" symbol={symbol} {...reg("cost")} invalid={Boolean(err("cost"))} disabled={disabled} />
              </FormField>
            </div>
          </SectionCard>

          <SectionCard
            title="Inventory"
            aside={
              <label className="flex items-center gap-2 text-sm">
                Track inventory
                <Switch checked={v.trackInventory} onCheckedChange={(c) => setValue("trackInventory", c, { shouldDirty: true })} disabled={disabled} aria-label="Track inventory" />
              </label>
            }
          >
            {v.trackInventory ? (
              <div className="grid gap-4 sm:grid-cols-3">
                {hasVariants ? null : (
                  <>
                    <FormField id="sku" label="SKU" optional error={err("sku")}>
                      <Input id="sku" {...reg("sku")} aria-invalid={Boolean(err("sku"))} aria-describedby="sku-msg" disabled={disabled} />
                    </FormField>
                    <FormField id="quantity" label="Inventory quantity" required error={err("quantity")}>
                      <Input id="quantity" inputMode="numeric" {...reg("quantity")} aria-invalid={Boolean(err("quantity"))} aria-describedby="quantity-msg" aria-required disabled={disabled} />
                    </FormField>
                  </>
                )}
                <FormField id="lowStockThreshold" label="Low-stock alert at" required error={err("lowStockThreshold")} hint="Flag when stock falls to this level.">
                  <Input id="lowStockThreshold" inputMode="numeric" {...reg("lowStockThreshold")} aria-invalid={Boolean(err("lowStockThreshold"))} aria-describedby="lowStockThreshold-msg" aria-required disabled={disabled} />
                </FormField>
                {hasVariants ? <p className="text-sm text-muted-foreground sm:col-span-2">Stock and SKUs are tracked per variant below.</p> : null}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-3">
                {hasVariants ? null : (
                  <FormField id="sku" label="SKU" optional error={err("sku")}>
                    <Input id="sku" {...reg("sku")} aria-invalid={Boolean(err("sku"))} aria-describedby="sku-msg" disabled={disabled} />
                  </FormField>
                )}
                <p className="text-sm text-muted-foreground sm:col-span-2">Inventory is not tracked: this product is always treated as available.</p>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Variants" description="Sizes, colours or other options. Each variant has its own SKU, price and stock.">
            <VariantsEditor
              options={v.options}
              variants={v.variants}
              basePrice={v.price}
              imagePaths={imagePaths}
              trackInventory={v.trackInventory}
              disabled={disabled}
              errors={errors}
              onOptionsChange={(o) => setValue("options", o, { shouldDirty: true })}
              onVariantsChange={(x) => setValue("variants", x, { shouldDirty: true })}
            />
          </SectionCard>
        </div>

        <div className="space-y-4">
          <SectionCard title="Status">
            <FormField id="status" label="Visibility" hint={v.status === "active" ? "Visible on your storefront." : "Hidden from your storefront."}>
              <NativeSelect id="status" {...register("status")} disabled={disabled}>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
              </NativeSelect>
            </FormField>
          </SectionCard>

          <SectionCard title="Organization">
            <FormField id="categoryId" label="Category" optional error={err("categoryId")}>
              <NativeSelect id="categoryId" {...reg("categoryId")} aria-invalid={Boolean(err("categoryId"))} aria-describedby="categoryId-msg" disabled={disabled}>
                <option value="">Uncategorised</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField id="productType" label="Product type" optional error={err("productType")}>
              <Input id="productType" {...reg("productType")} aria-invalid={Boolean(err("productType"))} aria-describedby="productType-msg" placeholder="e.g. T-shirt" disabled={disabled} />
            </FormField>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Collections <span className="ml-1 text-xs font-normal text-muted-foreground">(Optional)</span></legend>
              {collections.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No collections yet. <Link href={ROUTES.collections} className="text-link underline underline-offset-2">Create one</Link>.
                </p>
              ) : (
                <ul className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
                  {collections.map((c) => (
                    <li key={c.id}>
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <Checkbox
                          checked={v.collectionIds.includes(c.id)}
                          onCheckedChange={(on) => setValue("collectionIds", on === true ? [...v.collectionIds, c.id] : v.collectionIds.filter((x) => x !== c.id), { shouldDirty: true })}
                          disabled={disabled}
                        />
                        <span className="truncate">{c.name}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>
          </SectionCard>

          {mode === "edit" && canDelete ? (
            <Button type="button" variant="outline" className="w-full text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)} disabled={disabled}>
              <Trash2 aria-hidden /> Delete product
            </Button>
          ) : null}
        </div>
      </div>

      <div className="sticky bottom-0 z-20 -mx-3 mt-6 border-t bg-background/90 backdrop-blur sm:-mx-6">
        <div className="flex items-center justify-end gap-2 px-3 py-3 sm:px-6">
          {uploading ? <span className="mr-auto text-xs text-muted-foreground">Waiting for uploads to finish…</span> : null}
          <Link href={ROUTES.products} className={cn(buttonVariants({ variant: "outline" }), "h-9")}>
            {mode === "create" ? "Cancel" : "Back"}
          </Link>
          <Button type="submit" className="h-9" disabled={pending || uploading}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {pending ? "Saving…" : mode === "create" ? "Create product" : "Save changes"}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete "${initial?.product.name ?? "product"}"?`}
        description="This permanently removes the product, its variants and its images. This cannot be undone."
        confirmLabel="Delete product"
        onConfirm={async () => {
          const res = await deleteProductsAction([productId]);
          if (res.ok) {
            toast.success("Product deleted");
            router.replace(ROUTES.products);
          }
          return res;
        }}
      />
    </form>
  );
}

function MoneyInput({ symbol, invalid, id, ...props }: React.ComponentProps<"input"> & { symbol: string; invalid: boolean }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground" aria-hidden>
        {symbol}
      </span>
      <Input id={id} inputMode="decimal" placeholder="0.00" aria-invalid={invalid} aria-describedby={`${id}-msg`} className="pl-7 tabular-nums" {...props} />
    </div>
  );
}
