"use server";

import { revalidatePath } from "next/cache";
import { ROUTES } from "@/config/app";
import { run } from "@/lib/actions/run";
import { parseInput } from "@/lib/validations/parse";
import { templateSettingsSchema } from "@/lib/validations/templates";
import { saveTemplateSettings } from "@/services/template-settings.service";

export async function saveTemplateSettingsAction(input: unknown) {
  return run(async () => {
    await saveTemplateSettings(parseInput(templateSettingsSchema, input));
    revalidatePath(ROUTES.templates);
  });
}
