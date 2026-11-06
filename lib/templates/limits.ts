/**
 * Central limits for the template engine (decisions D6 and D27). Plain constants with no imports, so the
 * Drizzle schema, the validator, the services and the editor all read the same numbers.
 * The database repeats MAX_DOCUMENT_BYTES in a CHECK constraint (D6); everything else is enforced in the app.
 */
export const LIMITS = {
  /** Block nesting levels under a section (section > block > block > block). */
  maxBlockDepth: 3,
  maxSectionsPerTemplate: 25,
  /** Blocks per section, counted over all levels. */
  maxBlocksPerSection: 50,
  /** Sections plus blocks in one document. */
  maxComponentsPerTemplate: 400,
  maxDocumentBytes: 262_144,
  maxTextLength: 5_000,
  maxRichtextLength: 20_000,
  maxActiveTemplatesPerStore: 100,
  maxArchivedTemplatesPerStore: 500,
  maxVersionsPerTemplate: 500,
  maxNameLength: 80,
  maxVersionLabelLength: 80,
} as const;
