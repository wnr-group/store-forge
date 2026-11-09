import { describe, expect, it } from "vitest";
import { parseRichtext, type RichNode } from "../../lib/templates/engine/richtext";

describe("Engine Richtext Parser [AC-ENG-011]", () => {
  it("parses permitted richtext markdown constructs into typed AST nodes", () => {
    const input = "This is **bold** and *italic* text with a [Store Link](/products).\n\n- First item\n- Second item";
    const ast = parseRichtext(input);

    expect(ast.length).toBe(2); // Paragraph and List
    expect(ast[0].type).toBe("paragraph");
    expect(ast[1].type).toBe("list");

    const p = ast[0];
    if (p.type === "paragraph") {
      const boldNode = p.children.find((c) => c.type === "bold");
      expect(boldNode).toBeDefined();

      const italicNode = p.children.find((c) => c.type === "italic");
      expect(italicNode).toBeDefined();

      const linkNode = p.children.find((c) => c.type === "link");
      expect(linkNode).toBeDefined();
      if (linkNode && linkNode.type === "link") {
        expect(linkNode.href).toBe("/products");
      }
    }

    const list = ast[1];
    if (list.type === "list") {
      expect(list.ordered).toBe(false);
      expect(list.items.length).toBe(2);
    }
  });

  it("neutralizes script, arbitrary HTML, and event handlers", () => {
    const malicious = [
      '<script>alert("hacked")</script>',
      '<img src="x" onerror="alert(1)">',
      '<iframe src="https://evil.com"></iframe>',
      '<div onmouseover="stealCookies()">Hover me</div>',
      '<svg><a href="javascript:alert(1)"><text y="20">XSS</text></a></svg>',
    ];

    for (const src of malicious) {
      const ast = parseRichtext(src);
      // Recursively check all nodes in AST: no node should have HTML types or unsafe href
      const checkNode = (node: RichNode) => {
        expect(["paragraph", "list", "listItem", "text", "bold", "italic", "link"]).toContain(node.type);
        if (node.type === "link") {
          expect(node.href).not.toMatch(/^javascript:/i);
          expect(node.href).not.toMatch(/^data:/i);
        }
        if ("children" in node && Array.isArray(node.children)) {
          for (const child of node.children) checkNode(child);
        }
        if ("items" in node && Array.isArray(node.items)) {
          for (const item of node.items) checkNode(item);
        }
      };
      for (const node of ast) checkNode(node);
    }
  });

  it("rejects javascript: and data: links in markdown or HTML links", () => {
    const input = "[Malicious Link](javascript:alert(1)) and [Data Link](data:text/html,<script>alert(1)</script>)";
    const ast = parseRichtext(input);

    const checkNoUnsafeLinks = (node: RichNode) => {
      if (node.type === "link") {
        expect(node.href).not.toMatch(/^javascript:/i);
        expect(node.href).not.toMatch(/^data:/i);
      }
      if ("children" in node && Array.isArray(node.children)) {
        for (const child of node.children) checkNoUnsafeLinks(child);
      }
    };
    for (const node of ast) checkNoUnsafeLinks(node);
  });

  it("handles unbalanced markers and long input safely without throwing", () => {
    const unbalanced = "Here is **unbalanced bold and *unbalanced italic [unbalanced link";
    const ast = parseRichtext(unbalanced);
    expect(ast.length).toBeGreaterThan(0);

    const longText = "Safe text word. ".repeat(2000); // 32,000 chars
    const start = performance.now();
    const longAst = parseRichtext(longText);
    const duration = performance.now() - start;

    expect(longAst.length).toBeGreaterThan(0);
    expect(duration).toBeLessThan(100); // Must parse quickly
  });
});
