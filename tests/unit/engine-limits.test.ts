import { describe, expect, it } from "vitest";
import { LIMITS } from "../../lib/templates/limits";

describe("Central Limits and Quotas [AC-ENG-019]", () => {
  it("[AC-ENG-019] defines all limits and quotas in one central config without external imports", () => {
    expect(LIMITS).toMatchObject({
      maxBlockDepth: 3,
      maxSectionsPerTemplate: 25,
      maxBlocksPerSection: 50,
      maxComponentsPerTemplate: 400,
      maxDocumentBytes: 262_144,
      maxTextLength: 5_000,
      maxRichtextLength: 20_000,
      maxActiveTemplatesPerStore: 100,
      maxArchivedTemplatesPerStore: 500,
      maxVersionsPerTemplate: 500,
      maxNameLength: 80,
      maxVersionLabelLength: 80,
      maxAltLength: 200,
      maxValueDepth: 64,
    });

    // Object is frozen (as const)
    expect(Object.isFrozen(LIMITS)).toBe(true);
  });
});
