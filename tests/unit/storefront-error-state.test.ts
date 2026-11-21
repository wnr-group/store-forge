import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { StorefrontErrorState } from "@/components/storefront/error-state";

const html = (retrying = false) => renderToStaticMarkup(createElement(StorefrontErrorState, { onRetry: vi.fn(), retrying }));

describe("StorefrontErrorState", () => {
  it("tells shoppers the store is temporarily unavailable and offers Try again", () => {
    const out = html();
    expect(out).toContain("temporarily unavailable");
    expect(out).toContain("Try again");
    expect(out).toContain('role="alert"');
  });
  it("contains no dashboard link, no merchant wording and no link out at all", () => {
    expect(html()).not.toMatch(/dashboard|workspace|sign in|signed in|href=/i);
  });
  it("disables the button while a retry runs", () => {
    expect(html(true)).toMatch(/disabled/);
    expect(html(true)).toContain("Trying again");
  });
});
