import { describe, expect, it } from "vitest";
import { safeUrl } from "../../lib/templates/engine/bindings";
import { parseRichtext, type RichNode } from "../../lib/templates/engine/richtext";

/** Characters written by code point so no invisible character is stored in this source file. */
const chr = (...codes: number[]) => codes.map((c) => String.fromCharCode(c)).join("");
const BIDI = chr(0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069, 0x200e, 0x200f, 0x061c);
const INVISIBLE = chr(0x200b, 0x200c, 0x200d, 0x2060, 0xfeff, 0x00ad);
const CONTROLS = chr(0x00, 0x01, 0x07, 0x08, 0x0b, 0x0c, 0x1b, 0x7f, 0x80, 0x85, 0x9f);

const KEYS: Record<string, string[]> = {
  paragraph: ["children", "type"],
  list: ["items", "ordered", "type"],
  listItem: ["children", "type"],
  text: ["type", "value"],
  bold: ["children", "type"],
  italic: ["children", "type"],
  link: ["children", "href", "type"],
};

/** Returns every rule the AST breaks: permitted node types only, exact node shapes, plain strings, safe hrefs. */
function astViolations(blocks: RichNode[]): string[] {
  const problems: string[] = [];
  const stack: RichNode[] = [...blocks];
  let guard = 0;
  while (stack.length > 0) {
    const node = stack.pop() as unknown as Record<string, unknown>;
    if (++guard > 5_000_000) throw new Error("AST walk did not terminate");
    const type = node.type as string;
    if (Object.getPrototypeOf(node) !== Object.prototype) problems.push(`non-plain node ${type}`);
    if (!Object.prototype.hasOwnProperty.call(KEYS, type)) {
      problems.push(`forbidden node type ${String(type)}`);
      continue;
    }
    const keys = Object.keys(node).sort();
    if (keys.join() !== KEYS[type].join()) problems.push(`${type} has keys ${keys.join()}`);
    if (type === "text" && (typeof node.value !== "string" || node.value === "")) problems.push("text node is not a non-empty string");
    if (type === "link") {
      const href = node.href;
      if (typeof href !== "string" || safeUrl(href) !== href) problems.push(`unsafe href ${String(href)}`);
      else if (/^\/[\\/]/.test(href)) problems.push(`authority-relative href ${href}`);
    }
    if (type === "list" && typeof node.ordered !== "boolean") problems.push("list.ordered is not a boolean");
    if (type === "list" && Array.isArray(node.items)) {
      for (const item of node.items as RichNode[]) {
        if ((item as { type: string }).type !== "listItem") problems.push("list item is not a listItem");
        stack.push(item);
      }
    }
    if (Array.isArray(node.children)) stack.push(...(node.children as RichNode[]));
  }
  return problems;
}

function links(blocks: RichNode[]): string[] {
  const out: string[] = [];
  const walk = (nodes: RichNode[]) => {
    for (const n of nodes) {
      if (n.type === "link") out.push(n.href);
      if ("children" in n) walk(n.children);
      if ("items" in n) walk(n.items);
    }
  };
  walk(blocks);
  return out;
}

function texts(blocks: RichNode[]): string {
  let out = "";
  const walk = (nodes: RichNode[]) => {
    for (const n of nodes) {
      if (n.type === "text") out += n.value;
      if ("children" in n) walk(n.children);
      if ("items" in n) walk(n.items);
    }
  };
  walk(blocks);
  return out;
}

const NO_LINK_CORPUS: Array<[string, string]> = [
  ["script tag", '<script>alert("hacked")</script>'],
  ["img onerror", '<img src="x" onerror="alert(1)">'],
  ["img onerror unquoted", "<img src=x onerror=alert(1)>"],
  ["iframe", '<iframe src="https://evil.com"></iframe>'],
  ["div mouseover", '<div onmouseover="stealCookies()">Hover me</div>'],
  ["svg anchor", '<svg><a href="javascript:alert(1)"><text y="20">XSS</text></a></svg>'],
  ["svg onload", "<svg onload=alert(1)>"],
  ["body onload", "<body onload=alert(1)>"],
  ["html anchor", '<a href="javascript:alert(1)">x</a>'],
  ["style import", "<style>@import 'https://evil.example/x.css'</style>"],
  ["comment", "<!-- c --><script>alert(1)</script>"],
  ["split tag", "<scr<script>ipt>alert(1)</scr</script>ipt>"],
  ["double open", "<<script>script>alert(1)<</script>/script>"],
  ["bare event handler text", 'onerror=alert(1) " onmouseover="alert(1)'],
  ["javascript link", "[x](javascript:alert(1))"],
  ["mixed case javascript link", "[x](JaVaScRiPt:alert(1))"],
  ["padded javascript link", "[x]( javascript:alert(1))"],
  ["tab javascript link", "[x](java\tscript:alert(1))"],
  ["data link", "[x](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)"],
  ["vbscript link", "[x](vbscript:msgbox(1))"],
  ["file link", "[x](file:///etc/passwd)"],
  ["protocol relative link", "[x](//evil.example)"],
  ["protocol relative deep link", "[x](//evil.example/a/b?c#d)"],
  ["triple slash link", "[x](///evil.example)"],
  ["backslash authority link", "[x](/\\evil.example)"],
  ["double backslash link", "[x](\\\\evil.example)"],
  ["userinfo link", "[x](https://good.example@evil.example/)"],
  ["credentials link", "[x](https://user:pw@a.example/)"],
  ["attribute breakout link", '[x](https://a.example"onclick="alert(1))'],
  ["script in link text", "[<script>alert(1)</script>](javascript:alert(1))"],
  ["empty href", "[x]()"],
  ["entity-encoded scheme", "[x](&#106;avascript:alert(1))"],
  ["entity-encoded script tag", "&lt;script&gt;alert(1)&lt;/script&gt;"],
];

const SAFE_LINK_CORPUS: Array<[string, string, string[]]> = [
  ["relative", "[x](/products)", ["/products"]],
  ["fragment", "[x](#top)", ["#top"]],
  ["https", "[x](https://a.example/p?q=1)", ["https://a.example/p?q=1"]],
  ["mailto", "[x](mailto:a@b.example)", ["mailto:a@b.example"]],
  ["two links", "[a](/a) and [b](https://b.example)", ["/a", "https://b.example"]],
  ["in bold", "**[a](/a)**", ["/a"]],
  ["in list", "- [a](/a)\n- plain", ["/a"]],
];

describe("Richtext malicious corpus [AC-ENG-011]", () => {
  for (const [name, input] of NO_LINK_CORPUS) {
    it(`[AC-ENG-011] ${name} yields only permitted nodes and no link`, () => {
      const ast = parseRichtext(input);
      expect(astViolations(ast)).toEqual([]);
      expect(links(ast)).toEqual([]);
      expect(parseRichtext(input)).toEqual(ast);
    });
  }

  for (const [name, input, hrefs] of SAFE_LINK_CORPUS) {
    it(`[AC-ENG-011] safe ${name} link keeps its approved href`, () => {
      const ast = parseRichtext(input);
      expect(astViolations(ast)).toEqual([]);
      expect(links(ast)).toEqual(hrefs);
    });
  }

  it("[AC-ENG-011] an unsafe link keeps its text as plain text", () => {
    for (const href of ["javascript:alert", "//evil.example", "/\\evil.example", "data:text/html,x"]) {
      const ast = parseRichtext(`before [Click **me**](${href}) after`);
      expect(links(ast)).toEqual([]);
      expect(texts(ast)).toBe("before Click me after");
    }
  });

  it("[AC-ENG-011] HTML entities stay literal text and are never decoded into markup", () => {
    for (const input of ["&lt;script&gt;alert(1)&lt;/script&gt;", "&#60;script&#62;", "&#x3C;img src=x onerror=alert(1)&#x3E;", "&amp;lt;b&amp;gt;", "&quot;&apos;&nbsp;"]) {
      const ast = parseRichtext(input);
      expect(ast).toEqual([{ type: "paragraph", children: [{ type: "text", value: input }] }]);
    }
  });

  it("[AC-ENG-011] unbalanced and nested markers are parsed safely as text and formatting only", () => {
    const inputs = ["****", "**a*b**", "[[[", "[a](b", "[a](b)(c)", "]]]", "***", "*", "**", "[]", "[](", "[a]", "[a](", "[a]()", "(a)[b]", "***a***", "**a **b** c**", "[**a](/x)**", "[*a](/x)*", "[a](/x", "- ", "-", "1.", "1. ", "*** ***", "[a]](/x)", "[[a](/x)]"];
    for (const input of inputs) {
      const ast = parseRichtext(input);
      expect({ input, problems: astViolations(ast) }).toEqual({ input, problems: [] });
    }
    // Hand-checked shapes.
    expect(parseRichtext("[a](/x)(c)")).toEqual([
      { type: "paragraph", children: [{ type: "link", href: "/x", children: [{ type: "text", value: "a" }] }, { type: "text", value: "(c)" }] },
    ]);
    expect(parseRichtext("**a**")).toEqual([{ type: "paragraph", children: [{ type: "bold", children: [{ type: "text", value: "a" }] }] }]);
    expect(texts(parseRichtext("[[["))).toBe("[[[");
    expect(texts(parseRichtext("[a](b"))).toBe("[a](b");
    expect(texts(parseRichtext("]]]"))).toBe("]]]");
  });

  it("[AC-ENG-011] control, bidi and invisible characters pass through as plain text only", () => {
    for (const noise of [BIDI, INVISIBLE, CONTROLS]) {
      const input = `a${noise}b **c${noise}d** [e${noise}f](/x) <b${noise}>g</b>`;
      const ast = parseRichtext(input);
      expect(astViolations(ast)).toEqual([]);
      // The noise survives verbatim as text: in plain text, inside bold and inside link text. (The tag-like
      // run `<b..>` is dropped as markup by the parser, so only its content `g` is expected to remain.)
      const text = texts(ast);
      for (const part of [`a${noise}b`, `c${noise}d`, `e${noise}f`, "g"]) expect(text).toContain(part);
    }
    const ast = parseRichtext(`x${BIDI}y`);
    expect(texts(ast)).toContain(BIDI);
    // A control character inside an href makes it unsafe, even next to a valid scheme.
    expect(links(parseRichtext(`[x](https://a.example/${chr(0x01)}b)`))).toEqual([]);
    expect(links(parseRichtext(`[x](/ok${chr(0x7f)})`))).toEqual([]);
  });

  it("[AC-ENG-011] non-string input yields no nodes", () => {
    for (const value of [undefined, null, 0, 1, true, {}, [], ["a"], () => "a", ""]) {
      expect(parseRichtext(value as unknown as string)).toEqual([]);
    }
  });
});

const SHAPES: Record<string, (n: number) => string> = {
  plain: (n) => "Safe text word. ".repeat(Math.ceil(n / 16)),
  "unclosed bold": (n) => "**".repeat(n / 2),
  "unclosed bold with text": (n) => "**a ".repeat(Math.ceil(n / 4)),
  "unclosed italic": (n) => "*a".repeat(n / 2),
  "open brackets": (n) => "[".repeat(n),
  "unclosed links": (n) => "[a](".repeat(n / 4),
  "unclosed links with text": (n) => "[a](b".repeat(n / 5),
  "closed bracket, open paren": (n) => "[a]".repeat(Math.ceil(n / 3)) + "(",
  "close brackets": (n) => "]".repeat(n),
  "close parens": (n) => ")".repeat(n),
  "star and bracket": (n) => "*[".repeat(n / 2),
  "nested markers": (n) => "**[*".repeat(n / 4),
  "open tags": (n) => "<a".repeat(n / 2),
  "open angle": (n) => "<".repeat(n),
  "valid links": (n) => "[a](/x) ".repeat(Math.ceil(n / 8)),
  "valid bold": (n) => "**a** ".repeat(Math.ceil(n / 6)),
  "bullet lines": (n) => "- a\n".repeat(n / 4),
  "ordered lines": (n) => "1. a\n".repeat(n / 5),
  "short lines": (n) => "x\n".repeat(n / 2),
  digits: (n) => "1".repeat(n),
  "digit dots": (n) => "1.".repeat(n / 2),
  "only spaces": (n) => " ".repeat(n),
  "bullet then spaces": (n) => "-" + " ".repeat(n - 1),
  entities: (n) => "&lt;".repeat(n / 4),
  "bidi and controls": (n) => (BIDI + CONTROLS).repeat(Math.ceil(n / (BIDI.length + CONTROLS.length))),
};

function bestTime(src: string, runs: number): number {
  let best = Infinity;
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    parseRichtext(src);
    best = Math.min(best, performance.now() - start);
  }
  return best;
}

describe("Richtext stays fast on pathological input (no ReDoS) [AC-ENG-011]", () => {
  for (const [name, make] of Object.entries(SHAPES)) {
    it(`[AC-ENG-011] ${name}: 20,000 and 200,000 characters parse in linear time`, () => {
      const small = make(20_000);
      const big = make(200_000);
      expect(small.length).toBeGreaterThanOrEqual(20_000);
      const t20 = bestTime(small, 7);
      expect(t20).toBeLessThan(50);
      const t200 = bestTime(big, 7);
      expect(t200).toBeLessThan(100);
      // 10x the input must cost well under 15x the time (a quadratic parser would cost about 100x).
      expect(t200).toBeLessThan(15 * Math.max(t20, 2));
      expect(astViolations(parseRichtext(big))).toEqual([]);
    });
  }

  it("[AC-ENG-011] the original 32,000 character corpus input still parses fast", () => {
    expect(bestTime("Safe text word. ".repeat(2000), 7)).toBeLessThan(100);
  });
});
