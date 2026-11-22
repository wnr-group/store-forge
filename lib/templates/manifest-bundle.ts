/**
 * The read-only manifest bundle the API consumes. The committed file `manifest-bundle.generated.json` must equal
 * `serializeManifestBundle()`; tests/unit/manifest-bundle.test.ts fails on drift (AC-REG-01) and regenerates the file when run
 * with UPDATE_MANIFEST_BUNDLE=1. Generated, never edited by hand.
 */
import { MANIFEST_VERSION, type ComponentManifest } from "./manifest";
import { buildFirstPartyManifests } from "./manifests";

export type ManifestBundle = { bundleVersion: 1; manifestVersion: number; generatedBy: string; manifests: ComponentManifest[] };

export function buildManifestBundle(): ManifestBundle {
  return { bundleVersion: 1, manifestVersion: MANIFEST_VERSION, generatedBy: "lib/templates/manifest-bundle.ts", manifests: buildFirstPartyManifests() };
}

export function serializeManifestBundle(bundle: ManifestBundle = buildManifestBundle()): string {
  return `${JSON.stringify(bundle, null, 2)}\n`;
}
