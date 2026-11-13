"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { publishTemplateAction, saveDraftAction } from "@/app/(dashboard)/dashboard/templates/actions";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { TemplateDocument } from "@/lib/templates/document";
import { MAX_LABEL_LENGTH, MAX_MENU_ITEMS, newMenuItem, readMenu, validateMenu, writeMenu, type MenuItem } from "@/lib/themes/navigation";

export type LinkChoice = { label: string; url: string };

type Props = {
  templateId: string;
  revision: number;
  document: TemplateDocument;
  /** Where the menu can point without typing: home, the catalogue, collections and published pages. */
  choices: LinkChoice[];
  canManage: boolean;
  /** True when the draft differs from what shoppers see now. */
  hasUnpublishedChanges: boolean;
};

const CUSTOM = "__custom";

/** Edits the header menu of the store design: saves it as a draft, or saves and publishes it for shoppers. */
export function NavigationEditor({ templateId, revision, document, choices, canManage, hasUnpublishedChanges }: Props) {
  const router = useRouter();
  const initial = useMemo(() => readMenu(document) ?? [], [document]);
  const [items, setItems] = useState<MenuItem[]>(initial);
  const [rev, setRev] = useState(revision);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [unpublished, setUnpublished] = useState(hasUnpublishedChanges);
  const [showErrors, setShowErrors] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const errors = validateMenu(items);
  const dirty = JSON.stringify(items) !== saved;
  const disabled = !canManage || pending;

  const update = (id: string, patch: Partial<MenuItem>) => setItems((cur) => cur.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const move = (index: number, by: -1 | 1) =>
    setItems((cur) => {
      const next = [...cur];
      const target = index + by;
      if (target < 0 || target >= next.length) return cur;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const persist = (publish: boolean) => {
    setShowErrors(true);
    setMessage(null);
    if (Object.keys(errors).length > 0) {
      setMessage("Fix the highlighted links first.");
      return;
    }
    startTransition(async () => {
      let revision = rev;
      if (dirty) {
        const res = await saveDraftAction({ id: templateId, document: writeMenu(document, items), expectedRevision: rev });
        if (!res.ok) {
          setMessage(res.code === "CONFLICT" ? "The menu was changed somewhere else. Reload this page to see the latest version." : res.error);
          return;
        }
        revision = (res.data as { revision: number }).revision;
        setRev(revision);
        setSaved(JSON.stringify(items));
        setUnpublished(true);
      }
      if (publish) {
        const res = await publishTemplateAction({ id: templateId, expectedRevision: revision, label: "Navigation" });
        if (!res.ok) {
          setMessage(res.error);
          return;
        }
        setUnpublished(false);
        toast.success("Menu published. It is live on your store.");
      } else {
        toast.success("Draft saved. Customers will not see it until you publish.");
      }
      router.refresh();
    });
  };

  return (
    <div className="max-w-3xl space-y-4">
      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Main menu</h2>
            <p className="text-xs text-muted-foreground">Shown in the header of your store, in this order.</p>
          </div>
          <span className="text-xs text-muted-foreground">
            {items.length} of {MAX_MENU_ITEMS}
          </span>
        </div>

        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Your menu is empty. Add a link to start.</p>
        ) : (
          <ol className="divide-y">
            {items.map((item, index) => {
              const err = showErrors ? errors[item.id] : undefined;
              const preset = choices.some((c) => c.url === item.url) ? item.url : CUSTOM;
              return (
                <li key={item.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto]">
                  <FormField id={`label-${item.id}`} label="Label" error={err?.label} className="min-w-0">
                    <Input id={`label-${item.id}`} value={item.label} maxLength={MAX_LABEL_LENGTH + 10} disabled={disabled} aria-invalid={!!err?.label} aria-describedby={`label-${item.id}-msg`} onChange={(e) => update(item.id, { label: e.target.value })} />
                  </FormField>
                  <div className="min-w-0 space-y-1.5">
                    <FormField id={`link-${item.id}`} label="Link to" error={err?.url} className="min-w-0">
                      <NativeSelect id={`link-${item.id}`} value={preset} disabled={disabled} onChange={(e) => update(item.id, { url: e.target.value === CUSTOM ? "" : e.target.value })}>
                        {choices.map((c) => (
                          <option key={c.url} value={c.url}>
                            {c.label}
                          </option>
                        ))}
                        <option value={CUSTOM}>Custom address</option>
                      </NativeSelect>
                    </FormField>
                    {preset === CUSTOM ? (
                      <Input aria-label={`Address for ${item.label || "this link"}`} value={item.url} placeholder="https://example.com" disabled={disabled} aria-invalid={!!err?.url} onChange={(e) => update(item.id, { url: e.target.value })} />
                    ) : null}
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Checkbox checked={item.newTab} disabled={disabled} onCheckedChange={(v) => update(item.id, { newTab: v === true })} />
                      Open in a new tab
                    </label>
                  </div>
                  {canManage ? (
                    <div className="flex items-start gap-1 sm:pt-6">
                      <Button type="button" variant="ghost" size="icon-sm" aria-label={`Move ${item.label || "link"} up`} disabled={disabled || index === 0} onClick={() => move(index, -1)}>
                        <ArrowUp aria-hidden />
                      </Button>
                      <Button type="button" variant="ghost" size="icon-sm" aria-label={`Move ${item.label || "link"} down`} disabled={disabled || index === items.length - 1} onClick={() => move(index, 1)}>
                        <ArrowDown aria-hidden />
                      </Button>
                      <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${item.label || "link"}`} disabled={disabled} onClick={() => setItems((cur) => cur.filter((i) => i.id !== item.id))}>
                        <Trash2 aria-hidden />
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}

        {canManage ? (
          <div className="border-t px-4 py-3">
            <Button type="button" variant="outline" size="sm" disabled={disabled || items.length >= MAX_MENU_ITEMS} onClick={() => setItems((cur) => [...cur, newMenuItem(cur.map((i) => i.id), "", "/")])}>
              <Plus aria-hidden /> Add link
            </Button>
          </div>
        ) : null}
      </div>

      {message ? (
        <p role="alert" className="rounded-md border border-error/30 bg-error/10 px-3 py-2 text-sm text-destructive">
          {message}
        </p>
      ) : null}

      {canManage ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {dirty ? "You have unsaved changes." : unpublished ? "Saved as a draft. Not published yet." : "Published. Customers see this menu."}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={pending || !dirty} onClick={() => persist(false)}>
              Save draft
            </Button>
            <Button type="button" disabled={pending || (!dirty && !unpublished)} onClick={() => persist(true)}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Save and publish
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">You can view the menu but not change it.</p>
      )}
    </div>
  );
}
