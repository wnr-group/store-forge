import { describe, expect, it } from "vitest";
import { writeBenchmarkEvidence } from "../../scripts/qa/bench-evidence";
import type { ComponentNode, TemplateDocument } from "../../lib/templates/document";
import { jsonbByteLength } from "../../lib/templates/engine/size";
import { validateDocument } from "../../lib/templates/engine/validate";
import { LIMITS } from "../../lib/templates/limits";
import { getRegistry } from "../../lib/templates/registry/index";

describe("Engine Performance Benchmark [AC-ENG-020] [AC-PERF-008]", () => {
  const registry = getRegistry();

  // Evidence is written only when QA_EVIDENCE_DIR is set (never into a default path, never overwriting).
  // It is recorded before the budget assertion so a failing run is on record too.
  function recordEvidence(name: string, samples: number[], docBytes: number, components: number, sections: number): void {
    writeBenchmarkEvidence({
      name,
      acTags: ["AC-ENG-020", "AC-PERF-008"],
      iterations: samples.length,
      warmup: 5,
      documentBytes: docBytes,
      components,
      sections,
      budgetMs: 50,
      samples,
    });
  }

  function buildMaxDocument(): TemplateDocument {
    const doc: TemplateDocument = {
      schemaVersion: 1,
      layout: "classic",
      sections: {},
      order: [],
    };

    // 25 sections (max limit)
    // 15 blocks per section: 10 direct child blocks (within maxChildren: 10) + 5 nested blocks (depth 2)
    // 25 * 15 = 375 blocks + 25 sections = 400 components (max limit)
    let componentIndex = 0;
    for (let s = 0; s < 25; s++) {
      const secId = `section_${s}`;
      doc.order.push(secId);

      const blocks: Record<string, ComponentNode> = {};
      const block_order: string[] = [];

      for (let b = 0; b < 10; b++) {
        const blkId = `blk_${componentIndex++}`;
        block_order.push(blkId);

        const childBlocks: Record<string, ComponentNode> = {};
        const childOrder: string[] = [];

        // Add 1 nested child block for the first 5 blocks
        if (b < 5) {
          const childId = `blk_${componentIndex++}`;
          childOrder.push(childId);
          childBlocks[childId] = {
            type: "text",
            settings: {
              content: "Nested child block text content within limit depth 2.",
            },
            blocks: {},
            block_order: [],
          };
        }

        blocks[blkId] = {
          type: "text",
          settings: {
            content: "Sample body text paragraph representing merchant content inside the template component.",
          },
          blocks: childBlocks,
          block_order: childOrder,
        };
      }

      doc.sections[secId] = {
        type: "hero",
        settings: {
          heading: `Section Heading ${s} with substantial text content to increase byte size.`,
          subheading: "Supporting descriptive subheading line for benchmarking the validation engine thoroughly.",
          accentColor: "#1a5aaa",
        },
        blocks,
        block_order,
      };
    }

    return doc;
  }

  // Titled for what it is: 400 components (the count limit) but only about 69 KB. The recorded evidence name stays
  // "max-size document" so earlier runs and the evidence tooling still line up; the ~256 KB case is below.
  it("[AC-ENG-020] validates a 400-component document of about 69 KB in <= 50 ms", () => {
    const maxDoc = buildMaxDocument();
    const docBytes = Buffer.byteLength(JSON.stringify(maxDoc), "utf8");
    expect(docBytes).toBeGreaterThan(10_000);
    expect(docBytes).toBeLessThan(262_144);

    // Warm-up
    for (let i = 0; i < 5; i++) {
      const warmRes = validateDocument("index", maxDoc, registry);
      expect(warmRes.ok).toBe(true);
    }

    // Benchmark runs
    const iterations = 50;
    const timings: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const t0 = performance.now();
      const res = validateDocument("index", maxDoc, registry);
      const t1 = performance.now();
      expect(res.ok).toBe(true);
      timings.push(t1 - t0);
    }

    recordEvidence("max-size document", timings, docBytes, 400, 25);
    timings.sort((a, b) => a - b);
    const p50 = timings[Math.floor(iterations * 0.5)];
    const p95 = timings[Math.floor(iterations * 0.95)];
    const max = timings[timings.length - 1];

    console.log(`Validation Benchmark (N=${iterations}): p50=${p50.toFixed(2)}ms, p95=${p95.toFixed(2)}ms, max=${max.toFixed(2)}ms`);

    // Budget: p95 <= 50 ms (D19, AC-ENG-020, PERF-008)
    expect(p95).toBeLessThanOrEqual(50);
  });

  // Worst case for the tenant-aware scan: near the 256 KB / 400 component limits, every section a registered
  // hero with an image, every block an unknown type holding many image-shaped values, validated with a tenant.
  const BENCH_TENANT = "tenant-bench";
  const IMAGES_PER_BLOCK = 5;

  function buildImageDenseDocument(): TemplateDocument {
    const doc: TemplateDocument = { schemaVersion: 1, layout: "classic", sections: {}, order: [] };
    const image = (n: number) => ({ path: `${BENCH_TENANT}/store/gallery/photo_${n}.webp`, alt: `Gallery photo number ${n}` });
    let n = 0;
    for (let s = 0; s < 25; s++) {
      const secId = `section_${s}`;
      doc.order.push(secId);
      const blocks: Record<string, ComponentNode> = {};
      const block_order: string[] = [];
      // 10 direct blocks (hero maxChildren) + 5 nested ones: 25 + 250 + 125 = 400 components (the limit).
      // "text" is accepted by hero but not registered, so these are unknown blocks that only warn.
      const gallery = () => Array.from({ length: IMAGES_PER_BLOCK }, () => ({ image: image(n++) }));
      for (let b = 0; b < 10; b++) {
        const blkId = `blk_${s}_${b}`;
        block_order.push(blkId);
        const nested: Record<string, ComponentNode> = {};
        if (b < 5) nested[`${blkId}_child`] = { type: "text", settings: { gallery: gallery() }, blocks: {}, block_order: [] };
        blocks[blkId] = { type: "text", settings: { gallery: gallery() }, blocks: nested, block_order: Object.keys(nested) };
      }
      doc.sections[secId] = {
        type: "hero",
        settings: { heading: `Section ${s}`, accentColor: "#1a5aaa", image: image(n++) },
        blocks,
        block_order,
      };
    }
    return doc;
  }

  it("[AC-ENG-020] validates an image-dense max-size document with a tenant in <= 50 ms", () => {
    const denseDoc = buildImageDenseDocument();
    const docBytes = Buffer.byteLength(JSON.stringify(denseDoc), "utf8");
    expect(docBytes).toBeGreaterThan(200_000);
    expect(docBytes).toBeLessThan(262_144);
    expect(Object.keys(denseDoc.sections)).toHaveLength(25);
    expect(JSON.stringify(denseDoc).match(/"type":/g)).toHaveLength(400);

    // Warm-up. Unknown block types only warn, so the document is valid.
    for (let i = 0; i < 5; i++) {
      const warmRes = validateDocument("index", denseDoc, registry, { tenantId: BENCH_TENANT });
      expect(warmRes.ok).toBe(true);
    }

    const iterations = 50;
    const timings: number[] = [];
    for (let i = 0; i < iterations; i++) {
      const t0 = performance.now();
      const res = validateDocument("index", denseDoc, registry, { tenantId: BENCH_TENANT });
      const t1 = performance.now();
      expect(res.ok).toBe(true);
      timings.push(t1 - t0);
    }

    recordEvidence("image-dense max-size document with tenant", timings, docBytes, 400, 25);
    timings.sort((a, b) => a - b);
    const p50 = timings[Math.floor(iterations * 0.5)];
    const p95 = timings[Math.floor(iterations * 0.95)];
    const max = timings[timings.length - 1];
    console.log(
      `Image-dense Validation Benchmark (N=${iterations}, ${docBytes} bytes): p50=${p50.toFixed(2)}ms, p95=${p95.toFixed(2)}ms, max=${max.toFixed(2)}ms`,
    );

    // Budget: p95 <= 50 ms (D19, AC-ENG-020, PERF-008)
    expect(p95).toBeLessThanOrEqual(50);
  });

  // The true size worst case: 400 components (25 sections x (10 direct + 5 nested blocks)) padded with text until
  // the document measures about 98.5% of the 256 KB limit AS THE DATABASE MEASURES IT (jsonb text form), so the
  // size function, the schema parse and the walk all run at their limits together. Unknown "text" blocks only warn.
  const NEAR_LIMIT_TARGET = Math.floor(LIMITS.maxDocumentBytes * 0.985);

  function buildNearLimitDocument(): TemplateDocument {
    const build = (pad: number, extra: number): TemplateDocument => {
      const doc: TemplateDocument = { schemaVersion: 1, layout: "classic", sections: {}, order: [] };
      let index = 0;
      const text = (): ComponentNode => {
        const length = pad + (index++ === 0 ? extra : 0);
        return {
          type: "text",
          settings: { content: "lorem ipsum dolor sit amet, ".repeat(Math.ceil(length / 28)).slice(0, length) },
          blocks: {},
          block_order: [],
        };
      };
      for (let s = 0; s < 25; s++) {
        const secId = `section_${s}`;
        doc.order.push(secId);
        const blocks: Record<string, ComponentNode> = {};
        const block_order: string[] = [];
        for (let b = 0; b < 10; b++) {
          const blkId = `blk_${s}_${b}`;
          block_order.push(blkId);
          const nested: Record<string, ComponentNode> = {};
          if (b < 5) nested[`${blkId}_child`] = text();
          blocks[blkId] = { ...text(), blocks: nested, block_order: Object.keys(nested) };
        }
        doc.sections[secId] = { type: "hero", settings: { heading: `Section ${s}` }, blocks, block_order };
      }
      return doc;
    };
    const base = jsonbByteLength(build(0, 0));
    const pad = Math.floor((NEAR_LIMIT_TARGET - base) / 400);
    const slack = NEAR_LIMIT_TARGET - jsonbByteLength(build(pad, 0));
    return build(pad, slack);
  }

  it("[AC-ENG-020] validates a 400-component document within 5% of the 256 KB jsonb limit in <= 50 ms", () => {
    const nearLimit = buildNearLimitDocument();
    const jsonbBytes = jsonbByteLength(nearLimit);
    expect(jsonbBytes).toBeLessThanOrEqual(LIMITS.maxDocumentBytes);
    expect(jsonbBytes).toBeGreaterThanOrEqual(Math.ceil(LIMITS.maxDocumentBytes * 0.95));
    expect(JSON.stringify(nearLimit).match(/"type":/g)).toHaveLength(400);
    expect(Object.keys(nearLimit.sections)).toHaveLength(25);

    for (let i = 0; i < 5; i++) {
      expect(validateDocument("index", nearLimit, registry).ok).toBe(true);
    }

    const iterations = 50;
    const timings: number[] = [];
    for (let i = 0; i < iterations; i++) {
      const t0 = performance.now();
      const res = validateDocument("index", nearLimit, registry);
      const t1 = performance.now();
      expect(res.ok).toBe(true);
      timings.push(t1 - t0);
    }

    recordEvidence("near-limit 256 KB 400-component document", timings, jsonbBytes, 400, 25);
    timings.sort((a, b) => a - b);
    const p50 = timings[Math.floor(iterations * 0.5)];
    const p95 = timings[Math.floor(iterations * 0.95)];
    const max = timings[timings.length - 1];
    console.log(
      `Near-limit Validation Benchmark (N=${iterations}, ${jsonbBytes} jsonb bytes): p50=${p50.toFixed(2)}ms, p95=${p95.toFixed(2)}ms, max=${max.toFixed(2)}ms`,
    );

    // Budget: p95 <= 50 ms (D19, AC-ENG-020, PERF-008)
    expect(p95).toBeLessThanOrEqual(50);
  });

  // Wide worst case for the structural scan: ~12k primitive keys (about 170 KB, well inside the 256 KB limit) inside an unknown component's settings
  // (strings, numbers, booleans and nulls), validated with a tenant. Primitives can never be images, so the
  // scan must skip them without building per-child entries or path strings.
  function buildWidePrimitiveDocument(): TemplateDocument {
    const settings: Record<string, unknown> = {};
    for (let i = 0; i < 12_000; i++) {
      const kind = i % 4;
      settings[`k${i}`] = kind === 0 ? `v${i}` : kind === 1 ? i : kind === 2 ? i % 8 === 2 : null;
    }
    return {
      schemaVersion: 1,
      layout: "classic",
      sections: { wide: { type: "future-widget", settings, blocks: {}, block_order: [] } },
      order: ["wide"],
    };
  }

  it("[AC-ENG-020] validates a wide-primitive max-size document with a tenant in <= 50 ms", () => {
    const wideDoc = buildWidePrimitiveDocument();
    const docBytes = Buffer.byteLength(JSON.stringify(wideDoc), "utf8");
    expect(docBytes).toBeGreaterThan(150_000);
    expect(docBytes).toBeLessThan(262_144);
    expect(Object.keys(wideDoc.sections.wide.settings)).toHaveLength(12_000);

    for (let i = 0; i < 5; i++) {
      expect(validateDocument("index", wideDoc, registry, { tenantId: BENCH_TENANT }).ok).toBe(true);
    }

    const iterations = 50;
    const timings: number[] = [];
    for (let i = 0; i < iterations; i++) {
      const t0 = performance.now();
      const res = validateDocument("index", wideDoc, registry, { tenantId: BENCH_TENANT });
      const t1 = performance.now();
      expect(res.ok).toBe(true);
      timings.push(t1 - t0);
    }

    recordEvidence("wide-primitive max-size document with tenant", timings, docBytes, 1, 1);
    timings.sort((a, b) => a - b);
    const p50 = timings[Math.floor(iterations * 0.5)];
    const p95 = timings[Math.floor(iterations * 0.95)];
    const max = timings[timings.length - 1];
    console.log(
      `Wide-primitive Validation Benchmark (N=${iterations}, ${docBytes} bytes): p50=${p50.toFixed(2)}ms, p95=${p95.toFixed(2)}ms, max=${max.toFixed(2)}ms`,
    );

    // Budget: p95 <= 50 ms (D19, AC-ENG-020, PERF-008)
    expect(p95).toBeLessThanOrEqual(50);
  });
});
