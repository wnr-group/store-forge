import { createElement, type CSSProperties } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Mock next/image and next/link
vi.mock("next/image", async () => {
  const { createElement: h } = await import("react");
  return {
    default: (p: { src: string; alt: string; style?: CSSProperties; className?: string }) =>
      h("img", { src: p.src, alt: p.alt, style: p.style, className: p.className }),
  };
});
vi.mock("next/link", async () => {
  const { createElement: h } = await import("react");
  return {
    default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
      h("a", { href, ...rest }, children),
  };
});

import { ImageBlock } from "@/components/storefront/engine/blocks/image";
import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext } from "@/components/storefront/engine/types";

const mockContext: RenderContext = {
  store: { name: "Test Store", slug: "test-store" },
  mode: "public",
};

describe("Image Block & Media Settings [AC-REN-020]", () => {
  it("renders empty alt as alt='' explicitly when alt is not provided or empty [AC-REN-020]", () => {
    const node: ComponentNode = {
      type: "image",
      settings: {
        image: { path: "https://example.com/photo.jpg" }, // alt omitted
      },
      blocks: {},
      block_order: [],
    };

    const html = renderToStaticMarkup(createElement(ImageBlock, { node, context: mockContext }));
    expect(html).toContain('alt=""');
    expect(html).toContain('src="https://example.com/photo.jpg"');
  });

  it("renders provided alt text cleanly when given [AC-REN-020]", () => {
    const node: ComponentNode = {
      type: "image",
      settings: {
        image: { path: "https://example.com/photo.jpg", alt: "Sunset over hills" },
      },
      blocks: {},
      block_order: [],
    };

    const html = renderToStaticMarkup(createElement(ImageBlock, { node, context: mockContext }));
    expect(html).toContain('alt="Sunset over hills"');
  });

  it("applies focal point, aspect ratio, and object-fit via CSS styles [AC-REN-020]", () => {
    const node: ComponentNode = {
      type: "image",
      settings: {
        image: {
          path: "https://example.com/photo.jpg",
          alt: "Focused photo",
          focal: { x: 35, y: 75 },
        },
        aspectRatio: "16/9",
        objectFit: "contain",
        width: "large",
      },
      blocks: {},
      block_order: [],
    };

    const html = renderToStaticMarkup(createElement(ImageBlock, { node, context: mockContext }));
    // Verify CSS styles applied
    expect(html).toContain("object-position:35% 75%");
    expect(html).toContain("object-fit:contain");
    expect(html).toContain("aspect-ratio:16 / 9");
  });
});
