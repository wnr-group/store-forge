"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { saveCategoryAction } from "@/app/(dashboard)/dashboard/categories/actions";
import { useReportFormState, type FormState } from "@/components/shared/embedded-form";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useFormErrors } from "@/lib/forms/use-form-errors";
import { categoryInputSchema } from "@/lib/validations/catalog";

export type CategoryDraft = { id: string | null; name: string; slug: string; description: string; parentId: string };
export const blankCategory: CategoryDraft = { id: null, name: "", slug: "", description: "", parentId: "" };

/** The categories the parent picker is built from (any row of the category list has these). */
export type CategoryChoice = { id: string; name: string; parentId: string | null };

type Props = {
  /** What the form starts with: a blank category, a new subcategory (a parent set) or an existing category to edit. */
  initial: CategoryDraft;
  rows: CategoryChoice[];
  onSaved: () => void;
  onCancel: () => void;
  /** For a dialog that asks before it closes over unsaved changes. */
  onStateChange?: (state: FormState) => void;
};

/**
 * The category form of the Categories page, as one component: the page's dialog and the theme editor both show this, so the
 * fields, the validation (`categoryInputSchema`) and the server action (`saveCategoryAction`) are the same everywhere. It lays out
 * its own fields and a Cancel / Save footer; the dialog around it supplies the title.
 */
export function CategoryForm({ initial, rows, onSaved, onCancel, onStateChange }: Props) {
  const [draft, setDraft] = useState<CategoryDraft>(initial);
  const { errors, formError, pending, validate, validateField, clear, fail, submit } = useFormErrors();

  const payloadOf = (d: CategoryDraft) => ({ name: d.name, slug: d.slug.trim() || undefined, description: d.description, parentId: d.parentId || null });
  const change = (patch: Partial<CategoryDraft>, field: string) => {
    setDraft({ ...draft, ...patch });
    clear(field);
  };
  const blur = (field: string) => () => validateField(categoryInputSchema, payloadOf(draft), field);

  const dirty = draft.name !== initial.name || draft.slug !== initial.slug || draft.description !== initial.description || draft.parentId !== initial.parentId;
  useReportFormState(onStateChange, dirty, pending);

  const save = () => {
    const payload = payloadOf(draft);
    if (!validate(categoryInputSchema, payload)) return;
    submit(async () => {
      const res = await saveCategoryAction(draft.id, payload);
      if (!res.ok) {
        fail(res);
        return;
      }
      toast.success(draft.id ? "Category updated" : "Category created");
      onSaved();
    });
  };

  const hasChildren = draft.id ? rows.some((r) => r.parentId === draft.id) : false;
  const parentOptions = rows.filter((r) => !r.parentId && r.id !== draft.id);
  // An unchanged legacy parent stays selectable so saving never silently moves the category.
  const currentParent = draft.parentId ? rows.find((r) => r.id === draft.parentId) : undefined;
  if (currentParent && !parentOptions.some((r) => r.id === currentParent.id)) parentOptions.push(currentParent);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="space-y-3"
      noValidate
    >
      {formError ? <p role="alert" className="text-sm text-error">{formError}</p> : null}
      <FormField id="cat-name" label="Category name" required error={errors.name}>
        <Input id="cat-name" value={draft.name} onChange={(e) => change({ name: e.target.value }, "name")} onBlur={blur("name")} aria-invalid={Boolean(errors.name)} aria-describedby="cat-name-msg" aria-required autoFocus disabled={pending} />
      </FormField>
      <FormField id="cat-slug" label="Slug" required={Boolean(draft.id)} optional={!draft.id} error={errors.slug} hint={draft.id ? "Lowercase letters, numbers and hyphens." : "Leave blank to generate it from the name."}>
        <Input id="cat-slug" value={draft.slug} onChange={(e) => change({ slug: e.target.value }, "slug")} onBlur={blur("slug")} aria-invalid={Boolean(errors.slug)} aria-describedby="cat-slug-msg" disabled={pending} />
      </FormField>
      <FormField id="cat-parent" label="Parent category" optional error={errors.parentId} hint={hasChildren ? "This category has subcategories, so it cannot become a subcategory." : "Leave empty for a top-level category."}>
        <NativeSelect id="cat-parent" value={draft.parentId} onChange={(e) => change({ parentId: e.target.value }, "parentId")} aria-invalid={Boolean(errors.parentId)} aria-describedby="cat-parent-msg" disabled={pending || hasChildren}>
          <option value="">None (top level)</option>
          {parentOptions.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </NativeSelect>
      </FormField>
      <FormField id="cat-desc" label="Description" optional error={errors.description}>
        <Textarea id="cat-desc" rows={3} value={draft.description} onChange={(e) => change({ description: e.target.value }, "description")} onBlur={blur("description")} aria-invalid={Boolean(errors.description)} aria-describedby="cat-desc-msg" disabled={pending} />
      </FormField>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>Cancel</Button>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} {pending ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}
