"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ROUTES } from "@/config/app";
import { run } from "@/lib/actions/run";
import { parseInput } from "@/lib/validations/parse";
import { removeIntegration, saveIntegration, setIntegrationEnabled, testIntegration } from "@/services/integrations.service";

/** The providers this page knows. The API refuses any other with a 404, so this list only keeps junk away from it. */
const provider = z.enum(["ga4"]);
const value = z.string().trim().max(100);

// The tenant is never an argument: integrations.service resolves it from the verified session and checks the permission first.
export async function saveIntegrationAction(input: unknown) {
  return run(
    async () => {
      const v = parseInput(z.object({ provider, config: z.record(z.string(), value) }), input);
      await saveIntegration(v.provider, v.config);
      revalidatePath(ROUTES.integrations);
    },
    { operation: "integrations.save" },
  );
}

export async function setIntegrationEnabledAction(input: unknown) {
  return run(
    async () => {
      const v = parseInput(z.object({ provider, enabled: z.boolean() }), input);
      await setIntegrationEnabled(v.provider, v.enabled);
      revalidatePath(ROUTES.integrations);
    },
    { operation: "integrations.toggle" },
  );
}

export async function testIntegrationAction(input: unknown) {
  return run(async () => testIntegration(parseInput(z.object({ provider }), input).provider), { operation: "integrations.test" });
}

export async function removeIntegrationAction(input: unknown) {
  return run(
    async () => {
      await removeIntegration(parseInput(z.object({ provider }), input).provider);
      revalidatePath(ROUTES.integrations);
    },
    { operation: "integrations.remove" },
  );
}
