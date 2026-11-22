import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildManifestBundle, serializeManifestBundle } from "../../lib/templates/manifest-bundle";
import { validateManifest } from "../../lib/templates/manifest";

const FILE = join(__dirname, "..", "..", "lib", "templates", "manifest-bundle.generated.json");

// Regenerate with: UPDATE_MANIFEST_BUNDLE=1 node node_modules/vitest/vitest.mjs run tests/unit/manifest-bundle.test.ts
if (process.env.UPDATE_MANIFEST_BUNDLE === "1") writeFileSync(FILE, serializeManifestBundle());

describe("manifest bundle [AC-REG-01]", () => {
  it("the committed bundle equals the one generated from source (no drift)", () => {
    expect(readFileSync(FILE, "utf8").split("\r\n").join("\n")).toBe(serializeManifestBundle()); // a checkout may convert line endings
  });

  it("holds 43 valid manifests with unique kind and id", () => {
    const bundle = JSON.parse(readFileSync(FILE, "utf8")) as ReturnType<typeof buildManifestBundle>;
    expect(bundle.bundleVersion).toBe(1);
    expect(bundle.manifests).toHaveLength(43);
    expect(new Set(bundle.manifests.map((m) => `${m.kind}:${m.id}`)).size).toBe(43);
    for (const m of bundle.manifests) expect(validateManifest(m).ok).toBe(true);
  });

  it("is deterministic", () => {
    expect(serializeManifestBundle()).toBe(serializeManifestBundle());
  });
});
