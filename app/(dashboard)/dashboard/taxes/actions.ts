"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ROUTES } from "@/config/app";
import { run } from "@/lib/actions/run";
import { AppError } from "@/lib/errors";
import { GSTIN_PATTERN, GST_RATES_BPS } from "@/lib/tax/rates";
import { parseInput } from "@/lib/validations/parse";
import { saveTaxSettings } from "@/services/tax.service";

const rate = z.number().refine((n) => (GST_RATES_BPS as readonly number[]).includes(n), "Choose a valid GST rate.");

// The tenant is never an argument: tax.service resolves it from the verified session, and checks `tax:manage` first.
export async function saveTaxSettingsAction(input: unknown) {
  return run(
    async () => {
      const v = parseInput(
        z.object({
          enabled: z.boolean(),
          gstin: z.string().trim().toUpperCase().max(15),
          legalName: z.string().trim().max(200),
          pricesIncludeTax: z.boolean(),
          defaultRateBps: rate,
          chargesTaxable: z.boolean(),
          chargesRateBps: rate,
        }),
        input,
      );
      if (v.gstin && !GSTIN_PATTERN.test(v.gstin)) throw new AppError("VALIDATION", "Please correct the highlighted fields.", { gstin: "Enter a valid 15-character GSTIN." });
      if (v.enabled && !v.gstin) throw new AppError("VALIDATION", "Please correct the highlighted fields.", { gstin: "Enter your GSTIN to charge GST." });
      await saveTaxSettings({ ...v, gstin: v.gstin || null, legalName: v.legalName || null });
      revalidatePath(ROUTES.taxes);
    },
    { operation: "tax.settings.save" },
  );
}
