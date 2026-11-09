"use client";

import { TemplateView } from "@/components/storefront/templates";
import { toPreviewSaved, type TemplateFormValues } from "@/lib/templates/form-state";
import { resolveTemplateSettings } from "@/lib/templates/resolve";
import type { StorefrontData } from "@/lib/templates/types";

/** The same template component and settings resolution as the public page, fed with unsaved form values. Nothing here is stored. */
export function TemplatePreview({ storefront, values }: { storefront: StorefrontData | null; values: TemplateFormValues }) {
  if (!storefront) {
    return (
      <div role="status" className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Preview unavailable</p>
        <p className="mt-1">Your storefront is not publicly visible right now (the store or company is inactive), so there is nothing to preview. You can still choose and save a template.</p>
      </div>
    );
  }
  const settings = resolveTemplateSettings(storefront, toPreviewSaved(values));
  return (
    // inert: the preview is visual only, so its links and buttons cannot be clicked or focused.
    <div aria-label="Storefront preview" role="region" data-preview-template={values.templateKey} inert className="max-h-[32rem] overflow-auto rounded-xl border bg-background lg:max-h-[calc(100dvh-8rem)]">
      <div data-template={values.templateKey} className="contents">
        <TemplateView templateKey={values.templateKey} store={storefront} settings={settings} />
      </div>
    </div>
  );
}
