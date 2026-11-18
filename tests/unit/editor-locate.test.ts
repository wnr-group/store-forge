import { describe, expect, it } from "vitest";
import { findSettingForClick } from "@/lib/editor/locate";
import type { SettingDescriptor } from "@/lib/templates/engine/descriptors";

const d = (id: string, type: SettingDescriptor["type"], def: unknown = ""): SettingDescriptor => ({ id, type, label: id, default: def });
const heroDescriptors = [d("heading", "text"), d("subheading", "textarea"), d("buttonLabel", "text", "Shop now"), d("image", "image", null), d("link", "url")];

describe("findSettingForClick", () => {
  const settings = { heading: "Run faster", subheading: "Built for  the long run", image: { path: "t1/store/hero.jpg" } };
  const c = [{ descriptors: heroDescriptors, settings }];

  it("finds the setting that holds the clicked text, ignoring whitespace differences", () => {
    expect(findSettingForClick(c, { texts: ["Run faster"] })).toBe("heading");
    expect(findSettingForClick(c, { texts: ["Built for the long run"] })).toBe("subheading");
  });

  it("matches a setting still on its default", () => {
    expect(findSettingForClick(c, { texts: ["Shop now"] })).toBe("buttonLabel");
  });

  it("tries the clicked element, then its ancestors, innermost first", () => {
    expect(findSettingForClick(c, { texts: ["faster", "Run faster"] })).toBe("heading");
  });

  it("finds a picture by its stored path, also inside the optimiser address", () => {
    expect(findSettingForClick(c, { image: "https://x.supabase.co/storage/v1/object/public/t1/store/hero.jpg" })).toBe("image");
  });

  it("never jumps to a link or other non-text setting, and returns null for no match", () => {
    expect(findSettingForClick(c, { texts: ["something else"] })).toBeNull();
    expect(findSettingForClick([{ descriptors: heroDescriptors, settings: { link: "/shop" } }], { texts: ["/shop"] })).toBeNull();
  });

  it("looks at the block before the section when given in that order", () => {
    const block = [{ descriptors: [d("text", "text")], settings: { text: "Shared" } }];
    const section = [{ descriptors: [d("heading", "text")], settings: { heading: "Shared" } }];
    expect(findSettingForClick([...block, ...section], { texts: ["Shared"] })).toBe("text");
  });
});
