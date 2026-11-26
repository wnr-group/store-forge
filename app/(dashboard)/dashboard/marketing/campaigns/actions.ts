"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ROUTES } from "@/config/app";
import { run } from "@/lib/actions/run";
import { campaignPayloadSchema } from "@/lib/marketing/forms";
import { parseInput } from "@/lib/validations/parse";
import { createCampaign, deleteCampaign, getCampaign, setCampaignStatus, updateCampaign } from "@/services/marketing.service";

const id = z.string().uuid();

// The tenant is never an argument: marketing.service resolves it from the verified session and checks the permission first.
export async function saveCampaignAction(campaignId: string | null, input: unknown) {
  return run(
    async () => {
      const v = parseInput(campaignPayloadSchema, input);
      const saved = campaignId === null ? await createCampaign(v) : await updateCampaign(parseInput(id, campaignId), v);
      revalidatePath(ROUTES.campaigns);
      revalidatePath(ROUTES.discounts);
      return { id: saved.id };
    },
    { operation: "marketing.campaign.save" },
  );
}

export async function getCampaignAction(campaignId: unknown) {
  return run(async () => getCampaign(parseInput(id, campaignId)));
}

export async function setCampaignStatusAction(campaignId: unknown, status: unknown) {
  return run(
    async () => {
      await setCampaignStatus(parseInput(id, campaignId), parseInput(z.enum(["draft", "active", "paused", "completed"]), status));
      revalidatePath(ROUTES.campaigns);
      revalidatePath(ROUTES.discounts);
    },
    { operation: "marketing.campaign.status" },
  );
}

export async function deleteCampaignAction(campaignId: unknown) {
  return run(
    async () => {
      await deleteCampaign(parseInput(id, campaignId));
      revalidatePath(ROUTES.campaigns);
      revalidatePath(ROUTES.discounts);
    },
    { operation: "marketing.campaign.delete" },
  );
}
