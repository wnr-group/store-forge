import { describe, expect, it } from "vitest";
import {
  BINDING_SOURCES,
  isBindingSource,
  isCompatible,
  resolveBinding,
  type BindingContext,
} from "../../lib/templates/engine/bindings";
import { compileSettings } from "../../lib/templates/engine/compile";
import { checkDescriptors } from "../../lib/templates/engine/descriptor-check";
import { SETTING_TYPES, type SettingDescriptor, type SettingType } from "../../lib/templates/engine/descriptors";

const TENANT = "t1";

const FULL: BindingContext = {
  store: { name: "Acme", description: "The best shop" },
  product: {
    title: "Shoes",
    description: "Fast shoes",
    price: 99.5,
    compare_at_price: 120,
    sku: "SHOE-1",
    featured_image: { path: `${TENANT}/store/shoe.png`, alt: "Shoe" },
  },
  collection: { title: "Summer", description: "Sunny", featured_image: { path: `${TENANT}/store/sun.png` } },
};

/** The D9 compatibility table, restated here as an independent pin of source x setting type. */
const EXPECTED_TYPES: Record<string, SettingType[]> = {
  "store.name": ["text"],
  "store.description": ["text", "textarea", "richtext"],
  "product.title": ["text"],
  "product.description": ["text", "textarea", "richtext"],
  "product.price": ["number", "text"],
  "product.compare_at_price": ["number", "text"],
  "product.sku": ["text"],
  "product.featured_image": ["image"],
  "collection.title": ["text"],
  "collection.description": ["text", "textarea", "richtext"],
  "collection.featured_image": ["image"],
};

const HOSTILE_SOURCES = [
  "constructor",
  "constructor.name",
  "__proto__",
  "__proto__.polluted",
  "store.__proto__",
  "store.constructor",
  "product.constructor",
  "toString",
  "hasOwnProperty",
  "store.secret",
  "user.email",
  "{{ store.name }}",
  "${store.name}",
  "store.name.length",
  "store.name.toUpperCase()",
  "store['name']",
  "store.name; alert(1)",
  "store.name + 'x'",
  "a.b.c",
  "",
  " store.name",
  "STORE.NAME",
  "store.name\n",
];

describe("Binding sources are an allowlist [AC-ENG-012]", () => {
  it("[AC-ENG-012] only the eleven D9 sources are accepted", () => {
    expect([...BINDING_SOURCES]).toEqual(Object.keys(EXPECTED_TYPES));
    for (const source of BINDING_SOURCES) expect(isBindingSource(source)).toBe(true);
  });

  it("[AC-ENG-012] unknown, expression-like and prototype-named sources are rejected", () => {
    for (const source of HOSTILE_SOURCES) expect({ source, ok: isBindingSource(source) }).toEqual({ source, ok: false });
    for (const value of [null, undefined, 1, {}, [], ["store.name"]]) expect(isBindingSource(value)).toBe(false);
  });

  it("[AC-ENG-012] resolveBinding never resolves a source outside the allowlist: it yields the fallback only", () => {
    for (const source of HOSTILE_SOURCES) {
      expect({ source, value: resolveBinding({ source }, FULL) }).toEqual({ source, value: undefined });
      expect({ source, value: resolveBinding({ source, fallback: "FB" }, FULL) }).toEqual({ source, value: "FB" });
    }
    // The empty context has Object.prototype members, but they are never bindings.
    expect(resolveBinding({ source: "constructor.name" }, {})).toBeUndefined();
    expect(resolveBinding({ source: "__proto__.toString" }, {})).toBeUndefined();
  });

  it("[AC-ENG-012] a context scope that is not an own property is ignored", () => {
    const inherited = Object.create({ store: { name: "from prototype" } }) as BindingContext;
    expect(resolveBinding({ source: "store.name", fallback: "FB" }, inherited)).toBe("FB");
    // Neither is a field that is not an own property of its scope.
    const inheritedField = { store: Object.create({ name: "from prototype" }) } as BindingContext;
    expect(resolveBinding({ source: "store.name", fallback: "FB" }, inheritedField)).toBe("FB");
  });

  it("[AC-ENG-012] every allowlisted source resolves from the context", () => {
    expect(resolveBinding({ source: "store.name" }, FULL)).toBe("Acme");
    expect(resolveBinding({ source: "store.description" }, FULL)).toBe("The best shop");
    expect(resolveBinding({ source: "product.title" }, FULL)).toBe("Shoes");
    expect(resolveBinding({ source: "product.description" }, FULL)).toBe("Fast shoes");
    expect(resolveBinding({ source: "product.price" }, FULL)).toBe(99.5);
    expect(resolveBinding({ source: "product.compare_at_price" }, FULL)).toBe(120);
    expect(resolveBinding({ source: "product.sku" }, FULL)).toBe("SHOE-1");
    expect(resolveBinding({ source: "product.featured_image" }, FULL)).toEqual(FULL.product?.featured_image);
    expect(resolveBinding({ source: "collection.title" }, FULL)).toBe("Summer");
    expect(resolveBinding({ source: "collection.description" }, FULL)).toBe("Sunny");
    expect(resolveBinding({ source: "collection.featured_image" }, FULL)).toEqual(FULL.collection?.featured_image);
  });
});

describe("Binding type compatibility matrix [AC-ENG-012]", () => {
  it("[AC-ENG-012] every source x setting type pair matches the matrix exactly", () => {
    for (const source of BINDING_SOURCES) {
      for (const type of SETTING_TYPES) {
        const expected = EXPECTED_TYPES[source].includes(type);
        expect({ source, type, ok: isCompatible(source, type) }).toEqual({ source, type, ok: expected });
      }
    }
  });

  it("[AC-ENG-012] nothing outside the allowlist is compatible with any type", () => {
    for (const source of HOSTILE_SOURCES) {
      for (const type of SETTING_TYPES) expect(isCompatible(source, type)).toBe(false);
    }
  });

  it("[AC-ENG-012] no source binds to a url, colour, toggle, select, spacing, typography, border or dataBinding setting", () => {
    for (const source of BINDING_SOURCES) {
      for (const type of ["url", "color", "toggle", "select", "radio", "segmented", "spacing", "typography", "border", "dataBinding", "range"] as const) {
        expect(isCompatible(source, type)).toBe(false);
      }
    }
  });
});

describe("Binding fallback [AC-ENG-012]", () => {
  it("[AC-ENG-012] the fallback is used when the source is undefined, null, empty or whitespace", () => {
    const fb = { source: "store.name", fallback: "Fallback" };
    expect(resolveBinding(fb, {})).toBe("Fallback");
    expect(resolveBinding(fb, { store: {} })).toBe("Fallback");
    expect(resolveBinding(fb, { store: { name: undefined } })).toBe("Fallback");
    expect(resolveBinding(fb, { store: { name: null as unknown as string } })).toBe("Fallback");
    expect(resolveBinding(fb, { store: { name: "" } })).toBe("Fallback");
    expect(resolveBinding(fb, { store: { name: "   " } })).toBe("Fallback");
    expect(resolveBinding({ source: "store.name" }, { store: { name: "" } })).toBeUndefined();
  });

  it("[AC-ENG-012] a real value, including zero, wins over the fallback", () => {
    expect(resolveBinding({ source: "store.name", fallback: "FB" }, { store: { name: "Acme" } })).toBe("Acme");
    expect(resolveBinding({ source: "product.price", fallback: 5 }, { product: { price: 0 } })).toBe(0);
  });

  it("[AC-ENG-012] a malformed binding object never throws", () => {
    for (const binding of [null, undefined, 1, "store.name", [], {}, { source: 5 }, { source: null }]) {
      expect(() => resolveBinding(binding as never, FULL)).not.toThrow();
    }
  });

  describe("the fallback is validated for the target type by the compiled dataBinding control", () => {
    const d: SettingDescriptor = { id: "b", type: "dataBinding", label: "Binding", default: { source: "store.name" } };
    // `null` means "no tenant" (an explicit undefined would pick up the default parameter).
    const accepts = (value: unknown, tenantId: string | null = TENANT) =>
      compileSettings([d], { tenantId: tenantId ?? undefined }).schema.safeParse({ b: value }).success;

    it("[AC-ENG-012] text-like sources take a string, number or no fallback and reject objects, arrays and oversized text", () => {
      expect(accepts({ source: "store.name" })).toBe(true);
      expect(accepts({ source: "store.name", fallback: "Shop" })).toBe(true);
      expect(accepts({ source: "product.price", fallback: 10 })).toBe(true);
      expect(accepts({ source: "store.name", fallback: null })).toBe(true);
      expect(accepts({ source: "store.name", fallback: { a: 1 } })).toBe(false);
      expect(accepts({ source: "store.name", fallback: ["x"] })).toBe(false);
      expect(accepts({ source: "store.name", fallback: true })).toBe(false);
      expect(accepts({ source: "store.description", fallback: "x".repeat(20_000) })).toBe(true);
      expect(accepts({ source: "store.description", fallback: "x".repeat(20_001) })).toBe(false);
    });

    it("[AC-ENG-012] image sources take an image value under the owning tenant and reject strings, foreign paths and traversal", () => {
      const image = (fallback: unknown) => ({ source: "product.featured_image", fallback });
      expect(accepts(image({ path: `${TENANT}/store/a.png`, alt: "A" }))).toBe(true);
      expect(accepts(image(null))).toBe(true);
      expect(accepts({ source: "product.featured_image" })).toBe(true);
      expect(accepts(image("t1/store/a.png"))).toBe(false);
      expect(accepts(image({ path: "t2/store/a.png" }))).toBe(false);
      expect(accepts(image({ path: `${TENANT}/store/../../x.png` }))).toBe(false);
      expect(accepts(image({ path: `${TENANT}/store/a.png` }), null)).toBe(false);
    });

    it("[AC-ENG-012] an unknown or expression source is rejected by the compiled control", () => {
      for (const source of HOSTILE_SOURCES) expect({ source, ok: accepts({ source }) }).toEqual({ source, ok: false });
      expect(accepts({ source: 5 })).toBe(false);
      expect(accepts({ fallback: "x" })).toBe(false);
      expect(accepts("store.name")).toBe(false);
      expect(accepts({ source: "store.name", extra: 1 })).toBe(false);
    });

    it("[AC-ENG-012] allowedSources narrows the allowlist, and cannot widen it", () => {
      const narrow: SettingDescriptor = { ...d, allowedSources: ["store.name", "store.description"] };
      const schema = compileSettings([narrow]).schema;
      expect(schema.safeParse({ b: { source: "store.name" } }).success).toBe(true);
      expect(schema.safeParse({ b: { source: "product.title" } }).success).toBe(false);

      expect(checkDescriptors([narrow])).toEqual([]);
      const widened: SettingDescriptor = { ...d, allowedSources: ["store.name", "store.secret"] };
      expect(checkDescriptors([widened]).join("\n")).toMatch(/allowedSources|binding source/i);
    });
  });
});

describe("Binding URL restriction and no expression evaluation [AC-ENG-012]", () => {
  const ctx = (name: unknown): BindingContext => ({ store: { name: name as string } });

  it("[AC-ENG-012] a bound value that is not a safe URL never reaches a url setting", () => {
    for (const bad of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,x", "vbscript:x", "file:///etc/passwd", "java\nscript:x", "//evil.example.com"]) {
      expect({ bad, value: resolveBinding({ source: "store.name" }, ctx(bad), "url") }).toEqual({ bad, value: undefined });
    }
    expect(resolveBinding({ source: "store.name" }, ctx(42), "url")).toBeUndefined();
  });

  it("[AC-ENG-012] an unsafe URL falls back to a safe fallback, and an unsafe fallback is dropped too", () => {
    expect(resolveBinding({ source: "store.name", fallback: "/shop" }, ctx("javascript:alert(1)"), "url")).toBe("/shop");
    expect(resolveBinding({ source: "store.name", fallback: "javascript:alert(1)" }, ctx("javascript:alert(1)"), "url")).toBeUndefined();
    expect(resolveBinding({ source: "store.name", fallback: "javascript:alert(1)" }, ctx("https://ok.example/x"), "url")).toBe("https://ok.example/x");
    expect(resolveBinding({ source: "store.name", fallback: { href: "/x" } }, ctx(undefined), "url")).toBeUndefined();
  });

  it("[AC-ENG-012] http, https, relative and mailto bound values pass through the URL restriction", () => {
    for (const ok of ["https://example.com/a", "http://example.com", "/products", "mailto:a@example.com"]) {
      expect(resolveBinding({ source: "store.name" }, ctx(ok), "url")).toBe(ok);
    }
  });

  it("[AC-ENG-012] binding syntax inside a value or a fallback is returned as plain data, never evaluated", () => {
    const hostile = ["{{ store.description }}", "${store.description}", "store.description", "constructor.constructor('return 1')()"];
    for (const text of hostile) {
      expect(resolveBinding({ source: "store.name" }, { store: { name: text, description: "SECRET" } })).toBe(text);
      expect(resolveBinding({ source: "store.name", fallback: text }, { store: { description: "SECRET" } })).toBe(text);
    }
  });

  it("[AC-ENG-012] a function in the context is never called", () => {
    let called = false;
    const poisoned = {
      store: {
        name: () => {
          called = true;
          return "x";
        },
      },
    } as unknown as BindingContext;
    const result = resolveBinding({ source: "store.name" }, poisoned);
    expect(called).toBe(false);
    expect(typeof result).not.toBe("function");
    expect(result).toBeUndefined();
  });

  it("[AC-ENG-012] a function, symbol or bigint is never returned, whether it is the bound value or the fallback", () => {
    const nonJson = [() => 1, Symbol("s"), BigInt(10)];
    for (const value of nonJson) {
      // As the fallback: treated as no fallback, for an allowlisted source and for an unknown one.
      expect(resolveBinding({ source: "store.name", fallback: value }, {})).toBeUndefined();
      expect(resolveBinding({ source: "not.a.source", fallback: value }, FULL)).toBeUndefined();
      // As the resolved value: skipped, and the fallback (a plain one) takes over.
      const ctxWith = { store: { name: value } } as unknown as BindingContext;
      expect(resolveBinding({ source: "store.name" }, ctxWith)).toBeUndefined();
      expect(resolveBinding({ source: "store.name", fallback: "FB" }, ctxWith)).toBe("FB");
    }
    // A plain fallback keeps working, zero included.
    expect(resolveBinding({ source: "store.name", fallback: 0 }, {})).toBe(0);
  });
});

describe("Validating many binding values stays cheap [AC-ENG-012]", () => {
  const d: SettingDescriptor = { id: "b", type: "dataBinding", label: "Binding", default: { source: "store.name" } };
  // One value per fallback shape: text-like (string and number), and image (valid and invalid).
  const values: { value: unknown; ok: boolean }[] = [
    { value: { source: "store.name", fallback: "Shop" }, ok: true },
    { value: { source: "product.price", fallback: 10 }, ok: true },
    { value: { source: "product.price", fallback: true }, ok: false },
    { value: { source: "store.description", fallback: "x".repeat(20_001) }, ok: false },
    { value: { source: "product.featured_image", fallback: { path: `${TENANT}/store/a.png` } }, ok: true },
    { value: { source: "product.featured_image", fallback: { path: "t2/store/a.png" } }, ok: false },
    { value: { source: "unknown.source", fallback: "x" }, ok: false },
  ];

  it("[AC-ENG-012] 1,000 binding validations give the same results as a single one and are well under 100 ms", () => {
    const { schema } = compileSettings([d], { tenantId: TENANT });
    // Results are unchanged by repetition (a cached fallback schema must not carry state between parses).
    for (let round = 0; round < 3; round++) {
      for (const { value, ok } of values) {
        expect({ value, ok: schema.safeParse({ b: value }).success }).toEqual({ value, ok });
      }
    }
    // Best of five to stay tolerant of a loaded machine; the first run also warms the JIT.
    const durations: number[] = [];
    for (let run = 0; run < 5; run++) {
      const start = performance.now();
      for (let i = 0; i < 1000; i++) schema.safeParse({ b: values[i % values.length].value });
      durations.push(performance.now() - start);
    }
    expect(Math.min(...durations)).toBeLessThan(100);
  });
});
