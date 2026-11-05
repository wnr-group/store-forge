"use server";

import { revalidatePath } from "next/cache";
import { ROUTES } from "@/config/app";
import { run } from "@/lib/actions/run";
import { profileSchema, storeSettingsSchema } from "@/lib/validations/catalog";
import { parseInput } from "@/lib/validations/parse";
import { updateOwnName } from "@/services/profile.service";
import { updateStoreSettings } from "@/services/store-settings.service";

export async function saveStoreSettingsAction(input: unknown) {
  return run(async () => {
    await updateStoreSettings(parseInput(storeSettingsSchema, input));
    revalidatePath(ROUTES.dashboard, "layout");
  });
}

export async function saveProfileAction(input: unknown) {
  return run(async () => {
    await updateOwnName(parseInput(profileSchema, input).fullName);
    revalidatePath(ROUTES.dashboard, "layout");
  });
}
