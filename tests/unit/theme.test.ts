import { describe, expect, it } from "vitest";
import { THEME_INIT_SCRIPT, THEME_KEY } from "@/lib/theme/script";

/** Runs the inline pre-paint script against stubbed browser globals and returns what it applied. */
function runInitScript(opts: { stored?: string | null; systemDark?: boolean; storageThrows?: boolean }) {
  const classes = new Set<string>();
  const root = {
    classList: { toggle: (c: string, on: boolean) => void (on ? classes.add(c) : classes.delete(c)) },
    style: { colorScheme: "" },
  };
  const localStorage = {
    getItem: (k: string) => {
      if (opts.storageThrows) throw new Error("blocked");
      return k === THEME_KEY ? (opts.stored ?? null) : null;
    },
  };
  new Function("localStorage", "matchMedia", "document", THEME_INIT_SCRIPT)(localStorage, () => ({ matches: Boolean(opts.systemDark) }), { documentElement: root });
  return { dark: classes.has("dark"), colorScheme: root.style.colorScheme };
}

describe("theme pre-paint script", () => {
  it("honours an explicit choice regardless of the OS setting", () => {
    expect(runInitScript({ stored: "dark", systemDark: false })).toEqual({ dark: true, colorScheme: "dark" });
    expect(runInitScript({ stored: "light", systemDark: true })).toEqual({ dark: false, colorScheme: "light" });
  });

  it("follows the OS when nothing (or 'system') is stored", () => {
    expect(runInitScript({ stored: null, systemDark: true })).toEqual({ dark: true, colorScheme: "dark" });
    expect(runInitScript({ stored: "system", systemDark: false })).toEqual({ dark: false, colorScheme: "light" });
  });

  it("treats an unknown stored value like 'system' and never throws when storage is blocked", () => {
    expect(runInitScript({ stored: "purple", systemDark: true }).dark).toBe(true);
    expect(() => runInitScript({ storageThrows: true, systemDark: true })).not.toThrow();
  });
});
