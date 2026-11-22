import { describe, expect, it } from "vitest";
import {
  EMPTY_PRESENTATION,
  HIDEABLE_BLOCKS,
  canonicalPresentation,
  effectiveGalleryLayout,
  effectiveMediaPosition,
  isEmptyPresentation,
  isHiddenFor,
  parsePresentation,
  presentationKey,
  presentationOf,
  validatePresentation,
} from "@/lib/templates/product-presentation";
import { getRegistry } from "@/lib/templates/registry/index";

/** The presentation document: the same closed rules as the API (migration 0032), read defensively. */

describe("hideable identifiers match the engine registry", () => {
  const registry = getRegistry();
  it("five are block types the main-product section accepts and the registry defines; related-products is a section", () => {
    const accepted = registry.sections["main-product"].accepts ?? [];
    for (const id of HIDEABLE_BLOCKS) {
      if (id === "related-products") {
        expect(registry.sections[id]).toBeDefined();
        expect(registry.blocks[id]).toBeUndefined();
      } else {
        expect(registry.blocks[id], id).toBeDefined();
        expect(accepted, id).toContain(id);
      }
    }
    expect([...HIDEABLE_BLOCKS]).toEqual(["product-description", "product-sku", "product-type", "product-category", "social-share", "related-products"]);
  });
  it("title and price can never be hidden", () => {
    expect(validatePresentation({ schemaVersion: 1, hiddenBlocks: ["product-title"] })["hiddenBlocks[0]"]).toBeDefined();
    expect(validatePresentation({ schemaVersion: 1, hiddenBlocks: ["product-price"] })["hiddenBlocks[0]"]).toBeDefined();
  });
});

describe("parsePresentation (defensive)", () => {
  it("is null for anything that is not a usable document", () => {
    for (const bad of [null, undefined, 0, "x", [], true, {}, { schemaVersion: 2 }, { schemaVersion: "1" }]) expect(parsePresentation(bad)).toBeNull();
  });

  it("reads a full valid document", () => {
    const doc = { schemaVersion: 1, gallery: { layout: "stacked", mediaPosition: "right" }, focalPoint: { x: 20, y: 80 }, hiddenBlocks: ["product-sku", "related-products"] };
    expect(parsePresentation(doc)).toEqual(doc);
  });

  it("keeps the valid parts and drops each wrong part on its own", () => {
    const parsed = parsePresentation({
      schemaVersion: 1,
      gallery: { layout: "carousel", mediaPosition: "left" },
      focalPoint: { x: 120, y: 10 },
      hiddenBlocks: ["product-title", "social-share", "nope", 7, "social-share"],
      card: { anything: true },
      extra: 1,
    });
    expect(parsed).toEqual({ schemaVersion: 1, gallery: { mediaPosition: "left" }, hiddenBlocks: ["social-share"] });
  });

  it("never throws on hostile or odd shapes", () => {
    const hostile = [{ schemaVersion: 1, gallery: null, focalPoint: [], hiddenBlocks: "product-sku" }, { schemaVersion: 1, focalPoint: { x: NaN, y: Infinity } }, { schemaVersion: 1, hiddenBlocks: [null, {}, []] }, Object.create(null)];
    for (const h of hostile) expect(() => parsePresentation(h)).not.toThrow();
    expect(parsePresentation(hostile[0])).toEqual({ schemaVersion: 1 });
    expect(parsePresentation(hostile[1])).toEqual({ schemaVersion: 1 });
  });

  it("accepts the 0 and 100 edges of the focal point", () => {
    expect(parsePresentation({ schemaVersion: 1, focalPoint: { x: 0, y: 100 } })?.focalPoint).toEqual({ x: 0, y: 100 });
  });
});

describe("canonical form", () => {
  it("serializes the same whatever the key order or hidden-block order the database returns", () => {
    const a = { hiddenBlocks: ["social-share", "product-sku"], focalPoint: { y: 2, x: 1 }, gallery: { mediaPosition: "left", layout: "stacked" }, schemaVersion: 1 };
    const b = { schemaVersion: 1, gallery: { layout: "stacked", mediaPosition: "left" }, focalPoint: { x: 1, y: 2 }, hiddenBlocks: ["product-sku", "social-share"] };
    expect(presentationKey(a)).toBe(presentationKey(b));
    expect(canonicalPresentation(a)).toEqual(b);
  });
  it("an empty document inherits everything", () => {
    expect(isEmptyPresentation({ schemaVersion: 1 })).toBe(true);
    expect(isEmptyPresentation({ schemaVersion: 1, gallery: {} })).toBe(true);
    expect(isEmptyPresentation({ schemaVersion: 1, gallery: { layout: "stacked" } })).toBe(false);
    expect(presentationKey(null)).toBe(JSON.stringify(EMPTY_PRESENTATION));
  });
});

describe("validatePresentation (the editor's check before saving)", () => {
  it("accepts the documented documents", () => {
    expect(validatePresentation({ schemaVersion: 1 })).toEqual({});
    expect(validatePresentation({ schemaVersion: 1, gallery: { layout: "thumbnails", mediaPosition: "right" }, focalPoint: { x: 0, y: 100 }, hiddenBlocks: [...HIDEABLE_BLOCKS] })).toEqual({});
  });
  it("rejects unknown keys, including card settings, which the API does not support yet", () => {
    const p = validatePresentation({ schemaVersion: 1, card: { x: 1 }, gallery: { zoom: 2 }, focalPoint: { x: 1, y: 1, z: 1 } });
    expect(p.card).toBeDefined();
    expect(p["gallery.zoom"]).toBeDefined();
    expect(p["focalPoint.z"]).toBeDefined();
  });
  it("rejects bad values by path", () => {
    const p = validatePresentation({ schemaVersion: 2, gallery: { layout: "grid", mediaPosition: "top" }, focalPoint: { x: -1, y: 101 }, hiddenBlocks: ["product-sku", "product-sku", "bogus"] });
    expect(Object.keys(p).sort()).toEqual(["focalPoint.x", "focalPoint.y", "gallery.layout", "gallery.mediaPosition", "hiddenBlocks[1]", "hiddenBlocks[2]", "schemaVersion"]);
  });
  it("rejects non-objects and oversized documents", () => {
    expect(validatePresentation(null)[""]).toBeDefined();
    expect(validatePresentation([])[""]).toBeDefined();
    expect(validatePresentation({ schemaVersion: 1, hiddenBlocks: Array.from({ length: 2000 }, () => "product-sku") })[""]).toBeDefined();
  });
});

describe("precedence: product presentation, then the section setting, then the descriptor default", () => {
  const withPres = (gallery: object) => parsePresentation({ schemaVersion: 1, gallery });
  it("layout", () => {
    expect(effectiveGalleryLayout("stacked", withPres({ layout: "thumbnails" }))).toBe("thumbnails");
    expect(effectiveGalleryLayout("stacked", withPres({}))).toBe("stacked");
    expect(effectiveGalleryLayout("stacked", null)).toBe("stacked");
    expect(effectiveGalleryLayout(undefined, null)).toBe("thumbnails");
    expect(effectiveGalleryLayout("garbage", null)).toBe("thumbnails");
  });
  it("media position", () => {
    expect(effectiveMediaPosition("left", withPres({ mediaPosition: "right" }))).toBe("right");
    expect(effectiveMediaPosition("right", withPres({}))).toBe("right");
    expect(effectiveMediaPosition(undefined, null)).toBe("left");
  });
  it("hiding reads the presentation only, and is safe on anything", () => {
    const p = parsePresentation({ schemaVersion: 1, hiddenBlocks: ["product-sku", "related-products"] });
    expect(isHiddenFor(p, "product-sku")).toBe(true);
    expect(isHiddenFor(p, "related-products")).toBe(true);
    expect(isHiddenFor(p, "product-description")).toBe(false);
    expect(isHiddenFor(null, "product-sku")).toBe(false);
    expect(presentationOf(undefined)).toBeNull();
    expect(presentationOf({ presentation: "junk" })).toBeNull();
  });
});
