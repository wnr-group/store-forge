import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }), usePathname: () => "/" }));
vi.mock("next/image", async () => {
  const { createElement: h } = await import("react");
  return { default: (p: { src: string; alt: string }) => h("img", { src: p.src, alt: p.alt }) };
});
vi.mock("next/link", async () => {
  const { createElement: h } = await import("react");
  return { default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => h("a", { href, ...rest }, children) };
});
// The server actions reach the API and the database; the forms only need them to exist.
vi.mock("@/app/(dashboard)/dashboard/products/actions", () => ({ createProductAction: vi.fn(), updateProductAction: vi.fn(), deleteProductsAction: vi.fn() }));
vi.mock("@/app/(dashboard)/dashboard/categories/actions", () => ({ saveCategoryAction: vi.fn(), deleteCategoryAction: vi.fn() }));
vi.mock("@/app/(dashboard)/dashboard/collections/actions", () => ({ saveCollectionAction: vi.fn(), deleteCollectionAction: vi.fn() }));
vi.mock("@/app/(dashboard)/dashboard/uploads/actions", () => ({ requestUploadsAction: vi.fn() }));

import { blankCategory, CategoryForm } from "@/components/categories/category-form";
import { CollectionForm } from "@/components/collections/collection-form";
import { ProductForm } from "@/components/products/product-form";

const html = (el: React.ReactElement) => renderToStaticMarkup(el);
const noop = () => {};

describe("the editor shows the dashboard's own forms", () => {
  it("category: every field of the Categories page, with Cancel and Save", () => {
    const out = html(createElement(CategoryForm, { initial: blankCategory, rows: [{ id: "a", name: "Apparel", parentId: null }], onSaved: noop, onCancel: noop }));
    for (const id of ["cat-name", "cat-slug", "cat-parent", "cat-desc"]) expect(out).toContain(`id="${id}"`);
    expect(out).toContain("Apparel");
    expect(out).toMatch(/>Cancel</);
    expect(out).toMatch(/>\s*Save</);
  });

  it("collection: every section of the Collections page, and Cancel is a button in the dialog", () => {
    const out = html(createElement(CollectionForm, { mode: "create", products: [{ id: "p1", name: "Linen Throw" }], canDelete: false, embedded: { onCreated: noop, onCancel: noop } }));
    for (const id of ["col-name", "col-slug", "col-desc", "col-status"]) expect(out).toContain(`id="${id}"`);
    expect(out).toContain("Linen Throw");
    expect(out).toContain("Collection image");
    expect(out).not.toContain('href="/dashboard/collections"');
    expect(out).toMatch(/<button[^>]*type="button"[^>]*>Cancel</);
  });

  it("product: every section of the Products page, and Cancel is a button in the dialog", () => {
    const out = html(createElement(ProductForm, { mode: "create", currency: "INR", categories: [{ id: "c1", label: "Apparel" }], collections: [{ id: "l1", name: "Summer" }], canDelete: false, embedded: { onCreated: noop, onCancel: noop } }));
    for (const id of ["name", "shortDescription", "slug", "description", "price", "compareAtPrice", "cost", "sku", "productType", "categoryId", "status"]) expect(out).toContain(`id="${id}"`);
    for (const word of ["Media", "Variants", "Inventory", "Organization", "Apparel", "Summer"]) expect(out).toContain(word);
    expect(out).not.toContain('href="/dashboard/products"');
    expect(out).toMatch(/<button[^>]*type="button"[^>]*>Cancel</);
  });

  it("the dashboard pages are unchanged: without `embedded`, Cancel still goes back to the list", () => {
    const product = html(createElement(ProductForm, { mode: "create", currency: "INR", categories: [], collections: [], canDelete: false }));
    expect(product).toContain('href="/dashboard/products"');
    const collection = html(createElement(CollectionForm, { mode: "create", products: [], canDelete: false }));
    expect(collection).toContain('href="/dashboard/collections"');
  });
});
