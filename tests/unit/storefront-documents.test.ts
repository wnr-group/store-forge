import { describe, expect, it } from "vitest";
import { collectionsDocument, pageDocument, productListDocument, searchProducts } from "@/lib/storefront/documents";
import { pageInputSchema } from "@/lib/validations/pages";

describe("pageDocument", () => {
  it("turns paragraphs into text blocks and '# ' paragraphs into headings, after the title", () => {
    const doc = pageDocument("About us", "# Our story\n\nWe make things.\n\n\nSecond paragraph.");
    const section = doc.sections.content;
    expect(section.type).toBe("rich-text");
    const blocks = section.block_order.map((id) => section.blocks[id]);
    expect(blocks.map((b) => b.type)).toEqual(["heading", "heading", "text", "text"]);
    expect(blocks[0].settings).toMatchObject({ text: "About us", level: "h1" });
    expect(blocks[1].settings).toMatchObject({ text: "Our story", level: "h2" });
    expect(blocks[2].settings.content).toBe("We make things.");
    expect(doc.order).toEqual(["content"]);
  });

  it("handles Windows line endings and an empty body", () => {
    expect(pageDocument("T", "a\r\n\r\nb").sections.content.block_order).toHaveLength(3);
    expect(pageDocument("T", "").sections.content.block_order).toEqual(["title"]);
  });

  it("caps the number of blocks so a huge body cannot blow up the page", () => {
    const body = Array.from({ length: 1000 }, (_, i) => `p${i}`).join("\n\n");
    expect(pageDocument("T", body).sections.content.block_order.length).toBe(201);
  });
});

describe("generated listing documents", () => {
  it("builds a collection list and a product grid from engine sections", () => {
    expect(collectionsDocument().sections.collections.type).toBe("collection-list");
    const list = productListDocument("Search: x", "2 results");
    expect(list.order).toEqual(["intro", "grid"]);
    expect(list.sections.grid.type).toBe("product-grid");
    expect(list.sections.intro.block_order).toEqual(["title", "note"]);
  });
});

describe("searchProducts", () => {
  const products = [
    { name: "Linen Shirt", short_description: "Cool and light" },
    { name: "Wool Scarf", short_description: null },
    { name: "Denim Jacket", short_description: "A linen-blend lining" },
  ];
  it("matches name and description case-insensitively", () => {
    expect(searchProducts(products, "LINEN").map((p) => p.name)).toEqual(["Linen Shirt", "Denim Jacket"]);
  });
  it("needs every word, in any order", () => {
    expect(searchProducts(products, "shirt linen").map((p) => p.name)).toEqual(["Linen Shirt"]);
    expect(searchProducts(products, "linen scarf")).toEqual([]);
  });
  it("returns nothing for a blank term", () => {
    expect(searchProducts(products, "   ")).toEqual([]);
  });
});

describe("pageInputSchema", () => {
  it("accepts a blank address (made from the title) and defaults", () => {
    const v = pageInputSchema.parse({ title: " About ", slug: "  " });
    expect(v).toMatchObject({ title: "About", slug: undefined, body: "", status: "draft" });
  });
  it("rejects reserved and malformed addresses", () => {
    expect(pageInputSchema.safeParse({ title: "x", slug: "products" }).success).toBe(false);
    expect(pageInputSchema.safeParse({ title: "x", slug: "Not a slug" }).success).toBe(false);
    expect(pageInputSchema.safeParse({ title: "x", slug: "About-Us" }).data?.slug).toBe("about-us");
  });
  it("requires a title", () => {
    expect(pageInputSchema.safeParse({ title: "  " }).success).toBe(false);
  });
});
