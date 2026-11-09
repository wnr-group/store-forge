import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { describe, expect, it } from "vitest";
import { generateScreenshotIndex } from "../../scripts/qa/evidence-index";
import { validatePng } from "../../scripts/qa/png-check";
import { verifyEvidence } from "../../scripts/qa/verify-evidence";
import {
  appendLogManifest,
  appendScreenshotManifest,
  computeSha256,
  generateRunId,
  type LogManifestEntry,
  type ScreenshotManifestEntry,
} from "../e2e/support/evidence";

function crc32(buf: Buffer): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let j = 0; j < 8; j++) {
      c = (c >>> 1) ^ (-(c & 1) & 0xedb88320);
    }
  }
  return ~c >>> 0;
}

function makeChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  const typeAndData = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([len, typeAndData, crcBuf]);
}

function createSyntheticPng(opts: { width: number; height: number; uniform: boolean }): Buffer {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(opts.width, 0);
  ihdrData.writeUInt32BE(opts.height, 4);
  ihdrData.writeUInt8(8, 8); // 8-bit
  ihdrData.writeUInt8(2, 9); // RGB (3 bytes per pixel)
  ihdrData.writeUInt8(0, 10);
  ihdrData.writeUInt8(0, 11);
  ihdrData.writeUInt8(0, 12);
  const ihdrChunk = makeChunk("IHDR", ihdrData);

  // Scanlines: for each row: 1 byte filter (0), then width * 3 bytes
  const rowBytes = 1 + opts.width * 3;
  const rawData = Buffer.alloc(rowBytes * opts.height);
  for (let y = 0; y < opts.height; y++) {
    const rowOffset = y * rowBytes;
    rawData[rowOffset] = 0; // filter None
    for (let x = 0; x < opts.width; x++) {
      const pxOffset = rowOffset + 1 + x * 3;
      if (opts.uniform) {
        rawData[pxOffset] = 120;
        rawData[pxOffset + 1] = 120;
        rawData[pxOffset + 2] = 120;
      } else {
        rawData[pxOffset] = (x * 40 + y * 20) % 255;
        rawData[pxOffset + 1] = (y * 50) % 255;
        rawData[pxOffset + 2] = 200;
      }
    }
  }

  const deflated = zlib.deflateSync(rawData);
  const idatChunk = makeChunk("IDAT", deflated);
  const iendChunk = makeChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

describe("PNG Validator (png-check)", () => {
  it("validates a synthetic valid PNG with pixel variance", () => {
    const png = createSyntheticPng({ width: 10, height: 10, uniform: false });
    const result = validatePng(png);
    expect(result.valid).toBe(true);
    expect(result.width).toBe(10);
    expect(result.height).toBe(10);
    expect(result.variance).toBeGreaterThan(0.01);
  });

  it("rejects non-PNG buffers or truncated headers", () => {
    const badBuf = Buffer.alloc(120, "X");
    const result = validatePng(badBuf);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Invalid PNG signature");
  });

  it("rejects buffers below the minimum size", () => {
    const tiny = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const result = validatePng(tiny);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("below minimum threshold");
  });

  it("rejects a blank/uniform single-color image", () => {
    const blankPng = createSyntheticPng({ width: 50, height: 50, uniform: true });
    const result = validatePng(blankPng);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Pixel variance is effectively zero");
  });
});

describe("Evidence support helpers", () => {
  it("generates a RUN-ID matching the plan format", () => {
    const runId = generateRunId();
    expect(runId).toMatch(/^RUN-\d{14}-[0-9a-f]{4}$/);
  });

  it("computes SHA-256 correctly", () => {
    const testBuf = Buffer.from("StoreForge template engine evidence test");
    const sha = computeSha256(testBuf);
    expect(sha).toBe("205ae47a1901610b310bd381033a08158ffa4fbe03c4b42fa03b80319b55f8ad");
  });

  it("appends screenshot and log manifests safely without corruption", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sf-evidence-test-"));
    try {
      const shotEntry: ScreenshotManifestEntry = {
        evidenceId: "EV-TEST-001",
        ac: "AC-ED-001",
        scenario: "S-03",
        testId: "editor.spec.ts::open editor",
        file: "AC-ED-001-shell.png",
        path: "screenshots/RUN-TEST/AC-ED-001-shell.png",
        runId: "RUN-TEST",
        timestamp: new Date().toISOString(),
        browser: { name: "chromium", version: "1254" },
        viewport: { width: 1280, height: 800 },
        role: "owner",
        url: "http://localhost:3000/dashboard/templates/1/edit",
        commit: "testcommit",
        dirty: false,
        provenance: "current",
        description: "Editor shell three panes",
        sha256: "abc123def456",
      };

      appendScreenshotManifest(shotEntry, tempDir);
      const manifestPath = path.join(tempDir, "screenshots", "manifest.json");
      expect(fs.existsSync(manifestPath)).toBe(true);
      const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      expect(parsed).toHaveLength(1);
      expect(parsed[0].evidenceId).toBe("EV-TEST-001");

      const logEntry: LogManifestEntry = {
        evidenceId: "LOG-TEST-001",
        ac: "AC-DB-001",
        runId: "RUN-TEST",
        timestamp: new Date().toISOString(),
        path: "logs/RUN-TEST/vitest.log",
        sha256: "fedcba987654",
        provenance: "current",
        type: "vitest",
        commit: "testcommit",
        dirty: false,
      };

      appendLogManifest(logEntry, tempDir);
      const logManifestPath = path.join(tempDir, "logs", "log-manifest.json");
      expect(fs.existsSync(logManifestPath)).toBe(true);
      const parsedLogs = JSON.parse(fs.readFileSync(logManifestPath, "utf8"));
      expect(parsedLogs).toHaveLength(1);
      expect(parsedLogs[0].evidenceId).toBe("LOG-TEST-001");
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe("Evidence integrity verification (verify-evidence)", () => {
  it("passes on a clean directory with valid manifest and matching files", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sf-verify-test-"));
    try {
      const runId = "RUN-20261106120000-abcd";
      const shotDir = path.join(tempDir, "screenshots", runId);
      fs.mkdirSync(shotDir, { recursive: true });

      const png = createSyntheticPng({ width: 20, height: 20, uniform: false });
      const filename = "AC-ED-001-shell.png";
      const filePath = path.join(shotDir, filename);
      fs.writeFileSync(filePath, png);
      const sha256 = computeSha256(png);

      const entry: ScreenshotManifestEntry = {
        evidenceId: "EV-TEST-001",
        ac: "AC-ED-001",
        scenario: "S-03",
        testId: "editor.spec.ts::test",
        file: filename,
        path: `screenshots/${runId}/${filename}`,
        runId,
        timestamp: new Date().toISOString(),
        browser: { name: "chromium", version: "1254" },
        viewport: { width: 1280, height: 800 },
        role: "owner",
        url: "/dashboard/templates/1/edit",
        commit: "abc",
        dirty: false,
        provenance: "current",
        description: "Test description",
        sha256,
      };

      appendScreenshotManifest(entry, tempDir);

      const res = verifyEvidence(tempDir);
      expect(res.ok).toBe(true);
      expect(res.validCount).toBe(1);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("detects missing files and checksum mismatches", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sf-verify-fail-"));
    try {
      const entry: ScreenshotManifestEntry = {
        evidenceId: "EV-FAIL-001",
        ac: "AC-ED-001",
        scenario: "S-03",
        testId: "editor.spec.ts::test",
        file: "missing.png",
        path: "screenshots/RUN-TEST/missing.png",
        runId: "RUN-TEST",
        timestamp: new Date().toISOString(),
        browser: { name: "chromium", version: "1254" },
        viewport: { width: 1280, height: 800 },
        role: "owner",
        url: "/test",
        commit: "abc",
        dirty: false,
        provenance: "current",
        description: "Missing file",
        sha256: "fakehash",
      };

      appendScreenshotManifest(entry, tempDir);

      const res = verifyEvidence(tempDir);
      expect(res.ok).toBe(false);
      expect(res.issues.some((i) => i.rule === 1 && i.message.includes("File does not exist"))).toBe(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("detects duplicate image hashes without alsoSupports justification", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sf-verify-dup-"));
    try {
      const runId = "RUN-DUP";
      const shotDir = path.join(tempDir, "screenshots", runId);
      fs.mkdirSync(shotDir, { recursive: true });

      const png = createSyntheticPng({ width: 20, height: 20, uniform: false });
      const sha256 = computeSha256(png);

      const file1 = path.join(shotDir, "AC-ED-001-a.png");
      const file2 = path.join(shotDir, "AC-ED-002-b.png");
      fs.writeFileSync(file1, png);
      fs.writeFileSync(file2, png);

      const entry1: ScreenshotManifestEntry = {
        evidenceId: "EV-001",
        ac: "AC-ED-001",
        scenario: "S-01",
        testId: "t1",
        file: "AC-ED-001-a.png",
        path: `screenshots/${runId}/AC-ED-001-a.png`,
        runId,
        timestamp: new Date().toISOString(),
        browser: { name: "chromium", version: "1254" },
        viewport: { width: 1280, height: 800 },
        role: "owner",
        url: "/a",
        commit: "abc",
        dirty: false,
        provenance: "current",
        description: "First",
        sha256,
      };

      const entry2: ScreenshotManifestEntry = {
        evidenceId: "EV-002",
        ac: "AC-ED-002",
        scenario: "S-02",
        testId: "t2",
        file: "AC-ED-002-b.png",
        path: `screenshots/${runId}/AC-ED-002-b.png`,
        runId,
        timestamp: new Date().toISOString(),
        browser: { name: "chromium", version: "1254" },
        viewport: { width: 1280, height: 800 },
        role: "owner",
        url: "/b",
        commit: "abc",
        dirty: false,
        provenance: "current",
        description: "Second duplicate",
        sha256,
      };

      appendScreenshotManifest(entry1, tempDir);
      appendScreenshotManifest(entry2, tempDir);

      const res = verifyEvidence(tempDir);
      expect(res.ok).toBe(false);
      expect(res.issues.some((i) => i.rule === 5 && i.message.includes("Duplicate image checksum"))).toBe(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe("Screenshot Index Generator (evidence-index)", () => {
  it("formats markdown table from manifest", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sf-index-test-"));
    try {
      const entry: ScreenshotManifestEntry = {
        evidenceId: "EV-INDEX-001",
        ac: "AC-SF-001",
        scenario: "S-45",
        testId: "storefront.spec.ts::home",
        file: "AC-SF-001-home.png",
        path: "screenshots/RUN-TEST/AC-SF-001-home.png",
        runId: "RUN-TEST",
        timestamp: new Date().toISOString(),
        browser: { name: "chromium", version: "1254" },
        viewport: { width: 1280, height: 800 },
        role: "visitor",
        url: "/s/urban-nest-demo",
        commit: "commit1",
        dirty: false,
        provenance: "current",
        description: "Published classic homepage",
        sha256: "123456",
      };

      appendScreenshotManifest(entry, tempDir);
      const indexMd = generateScreenshotIndex(tempDir);
      expect(indexMd).toContain("| AC ID | Screenshot | Relative Path | What It Proves | Provenance |");
      expect(indexMd).toContain("AC-SF-001");
      expect(indexMd).toContain("AC-SF-001-home.png");
      expect(indexMd).toContain("Published classic homepage");
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
