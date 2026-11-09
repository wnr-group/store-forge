"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { discardUploadsAction } from "@/app/(dashboard)/dashboard/uploads/discard";
import { saveTemplateSettingsAction } from "@/app/(dashboard)/dashboard/templates/actions";
import { ImageUploader, type ImageItem } from "@/components/products/image-uploader";
import { FormField } from "@/components/shared/form-field";
import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useFormErrors } from "@/lib/forms/use-form-errors";
import { afterSave, baselineFrom, canCancel, canSave, formFrom, isDirty, normalizeForm, unsavedUploadPaths, type NormalizedTemplateValues, type TemplateFormValues } from "@/lib/templates/form-state";
import type { TemplateKey } from "@/lib/templates/registry";
import type { StorefrontData } from "@/lib/templates/types";
import { HERO_HEADING_MAX, HERO_SUBHEADING_MAX, templateSettingsSchema } from "@/lib/validations/templates";
import type { StoredTemplateSettings } from "@/services/template-settings.service";
import { TemplatePicker } from "./template-picker";
import { TemplatePreview } from "./template-preview";

type Props = { saved: StoredTemplateSettings | null; storefront: StorefrontData | null; canEdit: boolean };

const heroItems = (path: string | null): ImageItem[] =>
  path ? [{ key: "existing", path, altText: null, progress: 100, status: "done", saved: true }] : [];

export function TemplatesWorkspace({ saved, storefront, canEdit }: Props) {
  const router = useRouter();
  const [baseline, setBaseline] = useState<NormalizedTemplateValues>(() => baselineFrom(saved));
  const [fields, setFields] = useState(() => {
    const f = formFrom(baseline);
    return { templateKey: f.templateKey, accentColor: f.accentColor, heroHeading: f.heroHeading, heroSubheading: f.heroSubheading };
  });
  const [hero, setHero] = useState<ImageItem[]>(() => heroItems(baseline.heroImagePath));
  const { errors, formError, pending, validate, validateField, clear, fail, reset, submit: send } = useFormErrors();

  const heroPath = hero.find((i) => i.status === "done" && i.path)?.path ?? null;
  const current: TemplateFormValues = { ...fields, heroImagePath: heroPath };
  const uploading = hero.some((i) => i.status === "uploading");
  const dirty = isDirty(current, baseline);
  const off = pending || !canEdit;

  const set = (k: "accentColor" | "heroHeading" | "heroSubheading") => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFields({ ...fields, [k]: e.target.value });
    clear(k);
  };
  const blur = (k: string) => () => validateField(templateSettingsSchema, normalizeForm(current), k);
  const select = (key: TemplateKey) => {
    setFields({ ...fields, templateKey: key });
    clear("templateKey");
  };

  const save = () => {
    const payload = normalizeForm(current);
    if (!validate(templateSettingsSchema, payload)) return;
    send(async () => {
      const res = await saveTemplateSettingsAction(payload);
      if (!res.ok) {
        fail(res); // every edit stays; afterSave(state, { ok: false }) returns the state unchanged
        return;
      }
      setBaseline(afterSave({ current, baseline }, { ok: true }).baseline);
      setHero((items) => items.map((i) => (i.status === "done" ? { ...i, saved: true } : i)));
      toast.success("Template saved");
      router.refresh();
    });
  };

  const cancel = async () => {
    const orphans = unsavedUploadPaths(hero);
    if (orphans.length > 0) {
      // The server refuses to delete anything the logo or hero settings still reference.
      await discardUploadsAction(orphans).catch(() => undefined);
    }
    const f = formFrom(baseline);
    setFields({ templateKey: f.templateKey, accentColor: f.accentColor, heroHeading: f.heroHeading, heroSubheading: f.heroSubheading });
    setHero(heroItems(baseline.heroImagePath));
    reset();
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (canSave({ canEdit, dirty, pending, uploading })) save();
      }}
      className="grid gap-6 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]"
    >
      <div className="space-y-4">
        {!canEdit ? <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">Only owners and managers can change the template. You can preview any template.</p> : null}
        {formError ? <div role="alert" className="rounded-lg border border-error/30 bg-error/5 px-3 py-2 text-sm text-error">{formError}</div> : null}
        {errors.templateKey ? <p role="alert" className="text-sm text-error">{errors.templateKey}</p> : null}

        <SectionCard title="Template">
          <TemplatePicker selected={fields.templateKey} current={baseline.templateKey} onSelect={select} />
        </SectionCard>

        <SectionCard title="Customize" description="All fields are optional. Anything left empty uses your store details.">
          <FormField id="tpl-accent" label="Accent color" optional error={errors.accentColor} hint="A six-digit hex color, for example #1a2b3c.">
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label="Pick accent color"
                value={/^#[0-9a-fA-F]{6}$/.test(fields.accentColor) ? fields.accentColor : "#000000"}
                onChange={set("accentColor")}
                disabled={off}
                className="h-9 w-12 shrink-0 cursor-pointer rounded-md border bg-transparent p-1 disabled:cursor-not-allowed"
              />
              <Input id="tpl-accent" value={fields.accentColor} onChange={set("accentColor")} onBlur={blur("accentColor")} placeholder="#1a2b3c" disabled={off} aria-invalid={Boolean(errors.accentColor)} aria-describedby="tpl-accent-msg" />
            </div>
          </FormField>
          <FormField id="tpl-heading" label="Hero heading" optional error={errors.heroHeading} hint={`Up to ${HERO_HEADING_MAX} characters.`}>
            <Input id="tpl-heading" value={fields.heroHeading} onChange={set("heroHeading")} onBlur={blur("heroHeading")} disabled={off} aria-invalid={Boolean(errors.heroHeading)} aria-describedby="tpl-heading-msg" />
          </FormField>
          <FormField id="tpl-sub" label="Hero subheading" optional error={errors.heroSubheading} hint={`Up to ${HERO_SUBHEADING_MAX} characters.`}>
            <Textarea id="tpl-sub" rows={3} value={fields.heroSubheading} onChange={set("heroSubheading")} onBlur={blur("heroSubheading")} disabled={off} aria-invalid={Boolean(errors.heroSubheading)} aria-describedby="tpl-sub-msg" />
          </FormField>
          <div>
            <p className="mb-1 text-sm font-medium">Hero image <span className="font-normal text-muted-foreground">(optional)</span></p>
            <p className="mb-2 text-xs text-muted-foreground">Recommended: wide image, at least 1600 px.</p>
            <ImageUploader value={hero} onChange={setHero} scope="store" max={1} single disabled={off} label="Hero image" />
            {errors.heroImagePath ? <p role="alert" className="mt-1 text-sm text-error">{errors.heroImagePath}</p> : null}
          </div>
        </SectionCard>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={cancel} disabled={!canCancel({ dirty, pending, uploading })}>Cancel</Button>
          {canEdit ? (
            <Button type="submit" disabled={!canSave({ canEdit, dirty, pending, uploading })}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} {pending ? "Saving…" : "Save template"}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="min-w-0 lg:sticky lg:top-4 lg:self-start">
        <p className="mb-2 text-sm font-medium">Preview <span className="font-normal text-muted-foreground">(not live until you save)</span></p>
        <TemplatePreview storefront={storefront} values={current} />
      </div>
    </form>
  );
}
