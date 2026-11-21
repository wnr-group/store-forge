"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { listCategoryChoicesAction, listCategoryRowsAction } from "@/app/(dashboard)/dashboard/categories/actions";
import { listProductOptionsAction } from "@/app/(dashboard)/dashboard/collections/actions";
import { readQuickEditAction } from "@/app/(dashboard)/dashboard/products/actions";
import { blankCategory, CategoryForm } from "@/components/categories/category-form";
import { CollectionForm } from "@/components/collections/collection-form";
import { ProductForm } from "@/components/products/product-form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { QuickEditProduct } from "@/services/product.service";
import { useDiscardGuard } from "./discard-guard";

export type CreateKind = "product" | "category" | "collection";

/** What was just created, so the editor can show it at once. */
export type Created = { kind: "product"; product: QuickEditProduct; active: boolean } | { kind: "category" } | { kind: "collection" };

const COPY: Record<CreateKind, { title: string; description: string }> = {
  product: { title: "Add a product", description: "The same form as the Products page, added to your store without leaving the editor." },
  category: { title: "Add a category", description: "The same form as the Categories page. Group products under a category, and optionally a subcategory inside it." },
  collection: { title: "Add a collection", description: "The same form as the Collections page. Collections are the groups shoppers browse, like Shop by category." },
};

const Loading = () => (
  <div className="flex h-40 items-center justify-center text-muted-foreground"><Loader2 className="size-5 animate-spin" aria-label="Loading" /></div>
);

/**
 * Creates a product, a category or a collection without leaving the editor. Each one is the dashboard's own form (the Products,
 * Categories and Collections pages show the same components), so the fields, the validation and the server actions are the same;
 * this only lays them out in a dialog and tells the editor what was created. Closing the dialog with Esc, a click outside or Cancel
 * asks first when something was typed.
 */
export function QuickCreate({ kind, canEdit, currency, collections, onClose, onCreated }: { kind: CreateKind | null; canEdit: boolean; currency: string; collections: { id: string; name: string }[]; onClose: () => void; onCreated: (created: Created) => void }) {
  const guard = useDiscardGuard(onClose);

  // The pickers each form needs, read when the dialog opens (the store may have changed since the editor did).
  const productChoices = useQuery({
    queryKey: ["category-choices"],
    enabled: kind === "product",
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      const result = await listCategoryChoicesAction();
      if (!result.ok) throw new Error(result.error);
      return result.data!;
    },
  });
  const categoryRows = useQuery({
    queryKey: ["category-rows"],
    enabled: kind === "category",
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      const result = await listCategoryRowsAction();
      if (!result.ok) throw new Error(result.error);
      return result.data!;
    },
  });
  const productOptions = useQuery({
    queryKey: ["product-options"],
    enabled: kind === "collection",
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      const result = await listProductOptionsAction();
      if (!result.ok) throw new Error(result.error);
      return result.data!;
    },
  });

  const noAccess = <p className="text-sm text-muted-foreground">Adding {kind === "product" ? "products" : kind === "category" ? "categories" : "collections"} needs access to the catalogue.</p>;
  const failed = (message: string) => <p role="alert" className="text-sm text-destructive">{message}</p>;

  return (
    <>
      <Dialog open={kind !== null} onOpenChange={(open) => { if (!open) guard.requestClose(); }}>
        <DialogContent className={kind === "product" || kind === "collection" ? "sm:max-w-5xl" : "sm:max-w-md"}>
          {kind ? (
            <>
              <DialogHeader>
                <DialogTitle>{COPY[kind].title}</DialogTitle>
                <DialogDescription>{COPY[kind].description}</DialogDescription>
              </DialogHeader>
              {!canEdit ? (
                noAccess
              ) : kind === "product" ? (
                productChoices.isError ? (
                  failed(productChoices.error.message)
                ) : productChoices.isPending ? (
                  <Loading />
                ) : (
                  <ProductForm
                    key="product"
                    mode="create"
                    currency={currency}
                    categories={productChoices.data}
                    collections={collections}
                    canDelete={false}
                    embedded={{
                      onCancel: guard.requestClose,
                      onStateChange: guard.report,
                      // The product is listed in the preview at once: read it back as a card shows it.
                      onCreated: (id, status) => {
                        void readQuickEditAction(id).then((read) => onCreated(read.ok ? { kind: "product", product: read.data!, active: status === "active" } : { kind: "category" }));
                        guard.closeNow();
                      },
                    }}
                  />
                )
              ) : kind === "category" ? (
                categoryRows.isError ? (
                  failed(categoryRows.error.message)
                ) : categoryRows.isPending ? (
                  <Loading />
                ) : (
                  <CategoryForm
                    key="category"
                    initial={blankCategory}
                    rows={categoryRows.data}
                    onStateChange={guard.report}
                    onCancel={guard.requestClose}
                    onSaved={() => {
                      onCreated({ kind: "category" });
                      guard.closeNow();
                    }}
                  />
                )
              ) : productOptions.isError ? (
                failed(productOptions.error.message)
              ) : productOptions.isPending ? (
                <Loading />
              ) : (
                <CollectionForm
                  key="collection"
                  mode="create"
                  products={productOptions.data}
                  canDelete={false}
                  embedded={{
                    onCancel: guard.requestClose,
                    onStateChange: guard.report,
                    onCreated: () => {
                      onCreated({ kind: "collection" });
                      guard.closeNow();
                    },
                  }}
                />
              )}
            </>
          ) : null}
        </DialogContent>
      </Dialog>
      {guard.confirm}
    </>
  );
}
