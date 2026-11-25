import { describe, expect, it } from "vitest";
import { clearRecoveryToken, pendingRecoveryToken, scrubRecoveryToken } from "../../lib/tracking/url-scrub";

const TOKEN = "A".repeat(43);
const store = () => {
  const data = new Map<string, string>();
  return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
};
const run = (search: string, hash = "") => {
  const replaced: string[] = [];
  const session = store();
  const token = scrubRecoveryToken({ pathname: "/cart", search, hash }, (u) => replaced.push(u), session);
  return { token, replaced, session };
};

describe("keeping a recovery token out of the address", () => {
  it("takes the token out of the address and keeps it for this tab", () => {
    const r = run(`?recover=${TOKEN}`);
    expect(r.replaced).toEqual(["/cart"]);
    expect(r.token).toBe(TOKEN);
    expect(pendingRecoveryToken(r.session)).toBe(TOKEN);
  });

  it("leaves other parameters and the hash alone", () => {
    const r = run(`?utm_source=mail&recover=${TOKEN}&ref=x`, "#bag");
    expect(r.replaced).toEqual(["/cart?utm_source=mail&ref=x#bag"]);
  });

  it("does nothing when there is no token to remove", () => {
    const r = run("?utm_source=mail");
    expect(r.replaced).toEqual([]);
    expect(r.token).toBeNull();
    expect(pendingRecoveryToken(r.session)).toBeNull();
  });

  it("still removes a malformed value from the address, and keeps nothing", () => {
    for (const bad of ["short", `${TOKEN}x`, "<script>", ""]) {
      const r = run(`?recover=${encodeURIComponent(bad)}`);
      expect(r.replaced).toEqual(["/cart"]);
      expect(r.token).toBeNull();
      expect(pendingRecoveryToken(r.session)).toBeNull();
    }
  });

  it("forgets the token once it has been used", () => {
    const r = run(`?recover=${TOKEN}`);
    clearRecoveryToken(r.session);
    expect(pendingRecoveryToken(r.session)).toBeNull();
  });

  it("works when storage is blocked: the address is still cleaned", () => {
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    const replaced: string[] = [];
    expect(scrubRecoveryToken({ pathname: "/cart", search: `?recover=${TOKEN}`, hash: "" }, (u) => replaced.push(u), blocked)).toBe(TOKEN);
    expect(replaced).toEqual(["/cart"]);
    expect(pendingRecoveryToken(blocked)).toBeNull();
    expect(() => clearRecoveryToken(blocked)).not.toThrow();
    expect(pendingRecoveryToken(null)).toBeNull();
  });

  it("never returns a stored value that is not a token", () => {
    const s = store();
    s.data.set("sf-recover-token:v1", "tampered");
    expect(pendingRecoveryToken(s)).toBeNull();
  });
});
