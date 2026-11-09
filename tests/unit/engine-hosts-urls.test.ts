import { describe, expect, it } from "vitest";
import { resolveBinding, safeUrl, type BindingContext } from "../../lib/templates/engine/bindings";
import { compileSettings } from "../../lib/templates/engine/compile";
import type { SettingDescriptor } from "../../lib/templates/engine/descriptors";
import { parseRichtext, type InlineNode, type RichNode } from "../../lib/templates/engine/richtext";
import { ALLOWED_SOCIAL_NETWORKS, safeUrlSchema, socialLinksSchema } from "../../lib/templates/engine/schema";
import { LIMITS } from "../../lib/templates/limits";

const MAX = LIMITS.maxTextLength;

/** Every string here is non-blank; `markdown: false` marks values that cannot be written inside `[t](...)`. */
const ACCEPTED: Array<{ value: string; markdown?: boolean }> = [
  { value: "/products/x" },
  { value: "/" },
  { value: "#top" },
  { value: "/a?b=c#d" },
  { value: "https://a.example/x" },
  { value: "http://a.example" },
  { value: "HTTPS://A.EXAMPLE/x" },
  { value: "https://a.example:8443/x?q=1#f" },
  { value: "https://xn--e1afmkfd.example/" },
  { value: "http://localhost:3000/x" },
  { value: "http://127.0.0.1/x" },
  { value: "https://[::1]/x" },
  { value: "https://a-b.example./x" },
  { value: "mailto:a@b.example" },
  { value: "mailto:a@b.example?subject=hi" },
  { value: "  /padded  " },
  { value: `/${"a".repeat(MAX - 1)}` },
];

const REJECTED: Array<{ value: string; markdown?: boolean }> = [
  // Authority-relative forms: browsers read both "//" and "/\" as "host follows".
  { value: "//evil.example" },
  { value: "///x" },
  { value: "/\\evil.example" },
  { value: "/\\\\x" },
  { value: "\\\\evil" },
  { value: "\\evil" },
  // Schemes outside http/https/mailto, in every spelling.
  { value: "javascript:alert(1)", markdown: false },
  { value: "JaVaScRiPt:alert(1)", markdown: false },
  { value: "  javascript:alert(1)", markdown: false },
  { value: "data:text/html,x" },
  { value: "vbscript:msgbox(1)", markdown: false },
  { value: "file:///etc/passwd" },
  { value: "blob:https://a.example/uuid" },
  { value: "ftp://a.example" },
  { value: "java\tscript:alert(1)", markdown: false },
  { value: "java\nscript:alert(1)", markdown: false },
  { value: "java script:alert(1)", markdown: false },
  { value: "javascript\t:alert(1)", markdown: false },
  // Host spoofing and malformed authorities.
  { value: "https://user:pw@a.example/" },
  { value: "https://good.example@evil.example/" },
  { value: "https://@a.example/" },
  { value: "https://" },
  { value: "http://" },
  { value: "https:///evil.example" },
  { value: "https:/evil.example" },
  { value: "https:\\\\evil.example" },
  { value: "mailto:" },
  // Hostnames with quote or markup characters: not spoofing a real host, but never a legitimate one.
  { value: 'https://a.example"onclick="alert' },
  { value: "https://a.example'x/" },
  { value: "https://a.example`x/" },
  { value: "https://a.example{x}/" },
  { value: "https://exa!mple.example/" },
  { value: "https://exa*mple.example/" },
  { value: "https://-a.example/" },
  // Not a URL we accept at all.
  { value: "example.com/no-scheme" },
  { value: "?q=1" },
  { value: "../x" },
  { value: "./x" },
  { value: "x" },
  { value: "http://exa\tmple.com" },
  { value: "\u0001/products" },
  { value: "/ok\u0000" },
  // Length: one past the limit, and a padded value whose raw length is past the limit.
  { value: `/${"a".repeat(MAX)}` },
  { value: ` /${"a".repeat(MAX - 1)}` },
];

const urlDescriptor: SettingDescriptor = { id: "value", type: "url", label: "Link", default: "" };
const { schema: compiledSchema } = compileSettings([urlDescriptor]);

const bindingContext = (value: string): BindingContext => ({ store: { name: value } });

function findLinks(nodes: RichNode[], out: string[] = []): string[] {
  for (const node of nodes) {
    if (node.type === "link") out.push(node.href);
    if ("children" in node) findLinks(node.children as InlineNode[], out);
    if ("items" in node) findLinks(node.items, out);
  }
  return out;
}

/** Runs one value through every URL caller and returns what each of them decided. */
function decisions(value: string, viaMarkdown: boolean) {
  return {
    safeUrl: safeUrl(value) !== null,
    schema: safeUrlSchema.safeParse(value).success,
    compiled: compiledSchema.safeParse({ value }).success,
    binding: resolveBinding({ source: "store.name" }, bindingContext(value), "url") !== undefined,
    richtext: viaMarkdown ? findLinks(parseRichtext(`[t](${value})`)).length > 0 : undefined,
  };
}

describe("URL predicate is one rule for every caller [AC-ENG-012] [AC-ENG-011]", () => {
  for (const { value, markdown = true } of ACCEPTED) {
    it(`[AC-ENG-012] accepts ${JSON.stringify(value.length > 60 ? `${value.slice(0, 20)}...(${value.length})` : value)} everywhere`, () => {
      expect(decisions(value, markdown)).toEqual({
        safeUrl: true,
        schema: true,
        compiled: true,
        binding: true,
        richtext: markdown ? true : undefined,
      });
      expect(resolveBinding({ source: "store.name" }, bindingContext(value), "url")).toBe(safeUrl(value));
      if (markdown) expect(findLinks(parseRichtext(`[t](${value})`))).toEqual([safeUrl(value)]);
    });
  }

  for (const { value, markdown = true } of REJECTED) {
    it(`[AC-ENG-012] rejects ${JSON.stringify(value.length > 60 ? `${value.slice(0, 20)}...(${value.length})` : value)} everywhere`, () => {
      expect(decisions(value, markdown)).toEqual({
        safeUrl: false,
        schema: false,
        compiled: false,
        binding: false,
        richtext: markdown ? false : undefined,
      });
    });
  }

  it("[AC-ENG-012] the length boundary is exactly LIMITS.maxTextLength", () => {
    const atMax = `/${"a".repeat(MAX - 1)}`;
    const overMax = `${atMax}a`;
    expect(atMax).toHaveLength(MAX);
    expect(safeUrl(atMax)).toBe(atMax);
    expect(safeUrlSchema.safeParse(atMax).success).toBe(true);
    expect(safeUrl(overMax)).toBeNull();
    expect(safeUrlSchema.safeParse(overMax).success).toBe(false);
    const hostAtMax = `https://a.example/${"b".repeat(MAX - "https://a.example/".length)}`;
    expect(hostAtMax).toHaveLength(MAX);
    expect(safeUrl(hostAtMax)).toBe(hostAtMax);
    expect(safeUrl(`${hostAtMax}b`)).toBeNull();
  });

  it("[AC-ENG-012] rejects non-string input and keeps blank as 'no link' only in the schema", () => {
    for (const value of [undefined, null, 0, 1, true, {}, [], ["/x"], () => "/x"]) {
      expect(safeUrl(value as unknown as string)).toBeNull();
      expect(safeUrlSchema.safeParse(value).success).toBe(false);
    }
    expect(safeUrlSchema.safeParse("").success).toBe(true);
    expect(safeUrlSchema.safeParse(" \t ").success).toBe(true);
    expect(safeUrl("")).toBeNull();
  });

  it("[AC-ENG-012] binding to a url target falls back only to a safe fallback, never to the raw value", () => {
    const ctx = bindingContext("//evil.example");
    expect(resolveBinding({ source: "store.name", fallback: "/home" }, ctx, "url")).toBe("/home");
    expect(resolveBinding({ source: "store.name", fallback: "javascript:alert(1)" }, ctx, "url")).toBeUndefined();
    expect(resolveBinding({ source: "store.name", fallback: 42 }, ctx, "url")).toBeUndefined();
    expect(resolveBinding({ source: "product.sku", fallback: "https://a.example/x" }, ctx, "url")).toBe("https://a.example/x");
    // Other target types are untouched: the raw value still flows through to be validated by its own schema.
    expect(resolveBinding({ source: "store.name" }, ctx)).toBe("//evil.example");
    expect(resolveBinding({ source: "store.name" }, ctx, "text")).toBe("//evil.example");
  });
});

const HOST_ACCEPTED: Array<[string, string]> = [
  ["facebook", "https://facebook.com/x"],
  ["facebook", "https://facebook.com"],
  ["facebook", "https://www.facebook.com/mystore"],
  ["facebook", "https://FACEBOOK.COM/x"],
  ["facebook", "https://sub.facebook.com/x"],
  ["facebook", "https://facebook.com:443/x"],
  ["x", "https://twitter.com/mystore"],
  ["twitter", "https://x.com/mystore"],
  ["youtube", "https://www.youtube.com/@mystore"],
];

const HOST_REJECTED: Array<[string, unknown, string]> = [
  ["facebook", "https://evil-facebook.com/x", "prefix lookalike"],
  ["facebook", "https://notfacebook.com/x", "suffix without a dot"],
  ["facebook", "https://facebook.com.evil.example", "suffix host"],
  ["facebook", "https://facebook.com@evil.example", "userinfo spoof"],
  ["facebook", "https://user@facebook.com/x", "any userinfo"],
  ["facebook", "https://evil.example/facebook.com", "name in path"],
  ["facebook", "https://evil.example/?u=https://facebook.com", "name in query"],
  ["facebook", "https://evil.example/#facebook.com", "name in fragment"],
  ["facebook", "https://facebook.com.", "trailing dot"],
  ["facebook", "https://facebook.com./x", "trailing dot with path"],
  ["facebook", "https://faceb\u043E\u043Ek.com", "cyrillic o lookalike"],
  ["facebook", "https://xn--facebk-q5d9a.com", "punycode lookalike"],
  ["facebook", "https://facebook.com:8080/x", "non-default port"],
  ["facebook", "https://facebook.com:443@evil.example", "port-like userinfo"],
  ["facebook", "http://facebook.com", "http, not https"],
  ["facebook", "//facebook.com", "protocol relative"],
  ["facebook", "/facebook.com", "relative path"],
  ["facebook", "javascript:alert(1)", "javascript"],
  ["facebook", "HTTPS://FACEBOOK.COM@evil.example", "uppercase userinfo spoof"],
  ["facebook", "https://facebook.com/a https://facebook.com/b", "two urls in one value"],
  ["facebook", "https://facebook.com/a\nhttps://facebook.com/b", "newline separated urls"],
  ["facebook", "https://face\tbook.com/x", "tab inside the host"],
  ["facebook", "https://face\u200Bbook.com/x", "zero-width space inside the host"],
  ["facebook", " https://facebook.com/x", "leading space"],
  ["facebook", "https://facebook.com/x\n", "trailing newline"],
  ["facebook", `https://facebook.com/${"a".repeat(MAX)}`, "over the length limit"],
  ["facebook", "", "empty"],
  ["facebook", "   ", "blank"],
  ["facebook", "facebook.com", "no scheme"],
  ["facebook", "https://instagram.com/x", "another network's host"],
  ["facebook", "https:facebook.com/x", "scheme without slashes"],
  ["facebook", "https:/facebook.com/x", "scheme with one slash"],
  ["facebook", "https:\\\\facebook.com/x", "scheme with backslashes"],
  ["facebook", "https:///facebook.com/x", "scheme with three slashes"],
  ["facebook", "https://.facebook.com", "empty leading label"],
  ["facebook", "https://a..facebook.com", "empty inner label"],
  ["instagram", "https://facebook.com/x", "wrong network for the key"],
  ["x", "https://x.com.evil.example/y", "x.com as a prefix of another host"],
  ["x", "https://evilx.com/y", "x.com suffix without a dot"],
  ["facebook", 123, "number"],
  ["facebook", null, "null"],
  ["facebook", undefined, "undefined"],
  ["facebook", {}, "object"],
  ["facebook", ["https://facebook.com/x"], "array"],
  ["facebook", true, "boolean"],
];

describe("Social links: host-spoofing table [AC-ENG-017]", () => {
  it("[AC-ENG-017] the network list is closed and unchanged", () => {
    expect(Object.keys(ALLOWED_SOCIAL_NETWORKS).sort()).toEqual(
      ["facebook", "instagram", "linkedin", "pinterest", "tiktok", "twitter", "x", "youtube"],
    );
  });

  for (const [network, url] of HOST_ACCEPTED) {
    it(`[AC-ENG-017] accepts ${network}: ${url}`, () => {
      expect(socialLinksSchema.safeParse({ [network]: url }).success).toBe(true);
    });
  }

  for (const [network, url, why] of HOST_REJECTED) {
    it(`[AC-ENG-017] rejects ${network}: ${JSON.stringify(url)?.slice(0, 50)} (${why})`, () => {
      expect(socialLinksSchema.safeParse({ [network]: url }).success).toBe(false);
    });
  }

  it("[AC-ENG-017] rejects the whole record when any one entry is bad", () => {
    expect(
      socialLinksSchema.safeParse({ facebook: "https://facebook.com/x", instagram: "https://evil.example/x" }).success,
    ).toBe(false);
    expect(socialLinksSchema.safeParse({}).success).toBe(true);
  });

  it("[AC-ENG-017] rejects unknown, wrongly cased and prototype-named network keys", () => {
    for (const key of ["unknown", "Facebook", "FACEBOOK", " facebook", "facebook ", "constructor", "toString", "hasOwnProperty", "valueOf", "__proto__", "prototype"]) {
      expect(socialLinksSchema.safeParse({ [key]: "https://facebook.com/x" }).success).toBe(false);
    }
    // JSON.parse creates a real own "__proto__" key, the way a stored document would.
    const parsed = JSON.parse('{"__proto__": "https://facebook.com/x"}') as unknown;
    expect(Object.keys(parsed as object)).toEqual(["__proto__"]);
    expect(socialLinksSchema.safeParse(parsed).success).toBe(false);
    const nested = JSON.parse('{"facebook": "https://facebook.com/x", "constructor": "https://facebook.com/x"}') as unknown;
    expect(socialLinksSchema.safeParse(nested).success).toBe(false);
  });

  it("[AC-ENG-017] does not resolve a network through inherited properties", () => {
    const inherited = Object.create({ facebook: "https://evil.example/x" }) as Record<string, string>;
    // Own keys only: the inherited entry is never read, so an empty own record is valid and nothing is smuggled in.
    expect(socialLinksSchema.safeParse(inherited).success).toBe(true);
    const withInheritedKey = Object.create({ constructor: "https://facebook.com/x" }) as Record<string, string>;
    expect(socialLinksSchema.safeParse(withInheritedKey).success).toBe(true);
  });
});
