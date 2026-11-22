// Single list of test files that assert wall-clock budgets. They are excluded
// from the default Vitest run and executed serially by vitest.timing.config.mts
// so parallel load cannot skew their measurements. Run them explicitly with
// `vitest run --config vitest.timing.config.mts` (the default config excludes them).
export const TIMING_TEST_FILES: readonly string[] = [
  "tests/unit/engine-richtext-corpus.test.ts",
];
