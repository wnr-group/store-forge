import type { Page } from "@playwright/test";
import { capture } from "../../support/payments-evidence";

/**
 * Screenshot evidence from the REAL running website. The assertion runs FIRST; the picture is taken only after it passed,
 * full page, with every password field masked, and is refused when it holds a leak sentinel. Evidence is written only for an
 * evidence run (QA_EVIDENCE=1). The file name starts with the acceptance-criterion id.
 */
export async function shoot(
  page: Page,
  acId: string,
  slug: string,
  scenario: string,
  assertion: () => Promise<void>,
  options: { environment?: "local-stack" | "hosted" } = {},
) {
  return capture({
    acId,
    folder: "screenshots",
    fileName: `${acId}-${slug}.png`,
    layer: "PW",
    environment: options.environment ?? (process.env.E2E_ENVIRONMENT === "hosted" ? "hosted" : "local-stack"),
    testName: `payments.spec.ts > ${scenario}`,
    testFile: "tests/e2e/payments.spec.ts",
    actualResult: `${scenario}; the assertions passed before the screenshot was taken`,
    assert: assertion,
    content: async () => {
      const png = await page.screenshot({ fullPage: true, mask: [page.locator("input[type=password]")], animations: "disabled" });
      if (png.length < 4000) throw new Error(`screenshot for ${acId} is trivially small`);
      return png;
    },
  });
}

/** A non-image artifact (an API capture or a scan log) with the same rules. */
export async function record(acId: string, folder: "api-evidence" | "logs", scenario: string, content: object | string, assertion: () => Promise<void> | void) {
  return capture({
    acId,
    folder,
    fileName: `${acId}.${typeof content === "string" ? "txt" : "json"}`,
    layer: "PW",
    environment: process.env.E2E_ENVIRONMENT === "hosted" ? "hosted" : "local-stack",
    testName: `payments.spec.ts > ${scenario}`,
    testFile: "tests/e2e/payments.spec.ts",
    actualResult: scenario,
    assert: assertion,
    content: () => (typeof content === "string" ? content : { acId, layer: "PW", observed: content }),
  });
}
