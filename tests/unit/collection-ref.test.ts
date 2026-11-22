import { describe, expect, it } from "vitest";
import { collectionSelectValue, featuredCollectionSlugs, resolveCollection } from "@/lib/storefront/featured";
import type { TemplateDocument } from "@/lib/templates/document";

const cols = [{ id: "11111111-1111-4111-8111-111111111111", slug: "summer" }, { id: "22222222-2222-4222-8222-222222222222", slug: "winter" }];
const doc = (collectionId: string): TemplateDocument => ({ schemaVersion: 1, layout: "classic", order: ["f"], sections: { f: { type: "featured-collection", settings: { collectionId }, blocks: {}, block_order: [] } } });

describe("collectionSelectValue", () => {
  it("selects the collection by id", () => expect(collectionSelectValue(cols[0].id, cols)).toEqual({ value: cols[0].id, known: true }));
  it("maps a legacy slug to the collection's id", () => expect(collectionSelectValue("winter", cols)).toEqual({ value: cols[1].id, known: true }));
  it("treats empty and whitespace as no collection", () => {
    expect(collectionSelectValue("", cols)).toEqual({ value: "", known: true });
    expect(collectionSelectValue("  ", cols)).toEqual({ value: "", known: true });
    expect(collectionSelectValue(undefined, cols)).toEqual({ value: "", known: true });
  });
  it("keeps an unmatched reference visible as removed", () => expect(collectionSelectValue("gone", cols)).toEqual({ value: "gone", known: false }));
  it("handles a missing list", () => expect(collectionSelectValue(cols[0].id, undefined)).toEqual({ value: cols[0].id, known: false }));
});
describe("storefront resolves id and slug identically", () => {
  it("resolveCollection", () => {
    expect(resolveCollection(cols[0].id, cols)).toBe(cols[0]);
    expect(resolveCollection("summer", cols)).toBe(cols[0]);
    expect(resolveCollection("nope", cols)).toBeUndefined();
  });
  it("featuredCollectionSlugs", () => {
    expect(featuredCollectionSlugs([doc(cols[0].id)], cols)).toEqual(["summer"]);
    expect(featuredCollectionSlugs([doc("summer")], cols)).toEqual(["summer"]);
  });
});
