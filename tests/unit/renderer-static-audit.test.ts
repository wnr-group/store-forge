import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Mock next/image and next/link
vi.mock("next/image", async () => {
  const { createElement: h } = await import("react");
  return { default: (p: { src: string; alt: string }) => h("img", { src: p.src, alt: p.alt }) };
});
vi.mock("next/link", async () => {
  const { createElement: h } = await import("react");
  return { default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => h("a", { href, ...rest }, children) };
});

import { TemplateRenderer } from "@/components/storefront/engine/renderer";
import type { TemplateDocument } from "@/lib/templates/document";

const FORBIDDEN_SERVER_IMPORTS = [
  "server-only",
  "next/headers",
  "node:fs",
  "node:child_process",
  "node:net",
  "node:tls",
  "@/lib/db",
  "@/lib/auth/server",
];

function getAllFiles(dirPath: string, extensions = [".ts", ".tsx"]): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllFiles(fullPath, extensions));
    } else if (extensions.includes(path.extname(entry.name))) {
      results.push(fullPath);
    }
  }
  return results;
}

describe("Renderer Static Security and Isolation Audits [AC-REN-018] [AC-REN-019]", () => {
  const engineDir = path.resolve(process.cwd(), "components/storefront/engine");
  const registryDir = path.resolve(process.cwd(), "lib/templates/registry");

  it("renderer and components import no server-only or backend modules [AC-REN-018]", () => {
    const filesToAudit = [...getAllFiles(engineDir), ...getAllFiles(registryDir)];
    expect(filesToAudit.length).toBeGreaterThan(20);

    const violations: { file: string; forbidden: string }[] = [];

    for (const file of filesToAudit) {
      const content = fs.readFileSync(file, "utf8");
      for (const forbidden of FORBIDDEN_SERVER_IMPORTS) {
        // Look for import or require statements
        const importRegex = new RegExp(`(?:import|from|require)\\s*[(]?['"]${forbidden}['"]`, "g");
        if (importRegex.test(content)) {
          violations.push({ file: path.relative(process.cwd(), file), forbidden });
        }
      }
    }

    expect(violations, "Found forbidden server-only module imports in storefront engine").toEqual([]);
  });

  it("zero occurrences of dangerouslySetInnerHTML across all storefront engine files [AC-REN-019]", () => {
    const files = getAllFiles(engineDir);
    const violations: string[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, "utf8");
      if (content.includes("dangerouslySetInnerHTML")) {
        violations.push(path.relative(process.cwd(), file));
      }
    }

    expect(violations, "dangerouslySetInnerHTML is strictly prohibited in template renderer").toEqual([]);
  });

  it("plain text and bound text containing HTML/script tags are properly escaped [AC-REN-019]", () => {
    const maliciousDoc: TemplateDocument = {
      schemaVersion: 1,
      layout: "classic",
      sections: {
        hero: {
          type: "hero",
          settings: {
            variant: "classic",
            heading: "<script>alert('xss')</script>",
            subheading: "<img src=x onerror=alert('xss2')>",
          },
          blocks: {},
          block_order: [],
        },
        banner: {
          type: "announcement-bar",
          settings: {
            text: "<iframe src=javascript:alert('xss3')></iframe>",
          },
          blocks: {},
          block_order: [],
        },
      },
      order: ["hero", "banner"],
    };

    const html = renderToStaticMarkup(
      createElement(TemplateRenderer, {
        document: maliciousDoc,
        context: { store: { name: "Safe Store", slug: "safe-store" } },
        mode: "public",
      })
    );

    // Assert that executable tags do NOT appear unescaped
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<iframe");

    // Assert that text is escaped safely as HTML entities
    expect(html).toContain("&lt;script&gt;alert(&#x27;xss&#x27;)&lt;/script&gt;");
    expect(html).toContain("&lt;iframe src=javascript:alert(&#x27;xss3&#x27;)&gt;&lt;/iframe&gt;");
  });
});
