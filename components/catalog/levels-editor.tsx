"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Layers, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createLevelAction, deleteLevelAction, reorderLevelsAction, updateLevelAction } from "@/app/(dashboard)/dashboard/catalog/actions";
import { ActionDialog } from "@/components/shared/action-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormField } from "@/components/shared/form-field";
import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { levelOrderProblems, shiftId } from "@/lib/catalog/tree";
import { CATALOG_LIMITS, type CatalogLevel } from "@/lib/catalog/types";

type Draft = { id: string | null; name: string; canHoldProducts: boolean; /** Where a new level goes: "" = at the end. */ before: string };

/**
 * The levels of the catalog, top level first: add, rename, say which levels may carry products, reorder and delete. Nothing here
 * assumes a number of levels or their names. The API decides whether an order or a deletion is safe and explains why when it is not.
 */
export function LevelsEditor({ levels, canManage, canDelete }: { levels: CatalogLevel[]; canManage: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [toDelete, setToDelete] = useState<CatalogLevel | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  const move = (level: CatalogLevel, direction: -1 | 1) => {
    setProblems([]);
    startTransition(async () => {
      const res = await reorderLevelsAction(shiftId(levels.map((l) => l.id), level.id, direction));
      if (res.ok) {
        router.refresh();
        return;
      }
      const reasons = levelOrderProblems(res.details);
      if (reasons.length > 0) setProblems(reasons);
      toast.error(res.error);
    });
  };

  const submit = async () => {
    if (!draft) return { ok: false as const, error: "Nothing to save." };
    const input = { name: draft.name, canHoldProducts: draft.canHoldProducts };
    if (draft.id) return updateLevelAction(draft.id, input);
    const position = draft.before ? levels.find((l) => l.id === draft.before)?.position : undefined;
    return createLevelAction({ ...input, ...(position ? { position } : {}) });
  };

  const atLimit = levels.length >= CATALOG_LIMITS.maxLevels;
  return (
    <SectionCard
      title="Levels"
      description="The steps a shopper goes through, top level first. Name them for your business, for example Category, Subcategory, Item. Items can carry products only on the levels you allow."
      aside={
        canManage ? (
          <Button type="button" size="sm" onClick={() => setDraft({ id: null, name: "", canHoldProducts: levels.length === 0, before: "" })} disabled={atLimit}>
            <Plus aria-hidden /> Add level
          </Button>
        ) : null
      }
    >
      {levels.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
          <Layers className="mx-auto mb-2 size-5" aria-hidden />
          No levels yet. Add the first level (for example “Category”), then the levels below it.
        </p>
      ) : (
        <ol className="divide-y rounded-md border" aria-label="Levels, top level first">
          {levels.map((level, i) => (
            <li key={level.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium tabular-nums" aria-hidden>
                {level.position}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  <span className="sr-only">Level {level.position}: </span>
                  {level.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {level.nodeCount} {level.nodeCount === 1 ? "item" : "items"} · {level.canHoldProducts ? "Products can be placed here" : "No products on this level"}
                </p>
              </div>
              {canManage ? (
                <div className="flex items-center gap-1">
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={`Move ${level.name} up`} disabled={pending || i === 0} onClick={() => move(level, -1)}>
                    <ArrowUp aria-hidden />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={`Move ${level.name} down`} disabled={pending || i === levels.length - 1} onClick={() => move(level, 1)}>
                    <ArrowDown aria-hidden />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={`Edit ${level.name}`} onClick={() => setDraft({ id: level.id, name: level.name, canHoldProducts: level.canHoldProducts, before: "" })}>
                    <Pencil aria-hidden />
                  </Button>
                  {canDelete ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={level.nodeCount > 0 ? `${level.name} has items and cannot be deleted` : `Delete ${level.name}`}
                      title={level.nodeCount > 0 ? "Delete or move its items first" : undefined}
                      disabled={level.nodeCount > 0}
                      onClick={() => setToDelete(level)}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      )}
      {pending ? (
        <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" aria-hidden /> Updating the order…
        </p>
      ) : null}
      {problems.length > 0 ? (
        <div role="alert" className="rounded-md border border-error/40 bg-error/5 p-3 text-sm">
          <p className="font-medium text-error">The levels were not reordered, because existing items depend on the current order:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">Move the items to the new structure first, or reorder levels that have no items.</p>
        </div>
      ) : null}
      {atLimit ? <p className="text-xs text-muted-foreground">A catalog can have at most {CATALOG_LIMITS.maxLevels} levels.</p> : null}

      {draft ? (
        <ActionDialog
          key={draft.id ?? "new"}
          open
          onOpenChange={(o) => !o && setDraft(null)}
          title={draft.id ? "Edit level" : "Add level"}
          description={draft.id ? "Renaming is always safe: items keep their place." : "A new level goes at the end unless you choose where it should go."}
          submitLabel={draft.id ? "Save level" : "Add level"}
          success={draft.id ? "Level saved" : "Level added"}
          onSubmit={submit}
        >
          <FormField id="level-name" label="Name" required hint="For example Brand, Vehicle or Part category.">
            <Input id="level-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={60} autoFocus />
          </FormField>
          {draft.id === null && levels.length > 0 ? (
            <FormField id="level-before" label="Position" hint="Putting a level before levels that already have items is refused when it would break their structure.">
              <NativeSelect id="level-before" value={draft.before} onChange={(e) => setDraft({ ...draft, before: e.target.value })}>
                <option value="">At the end</option>
                {levels.map((l) => (
                  <option key={l.id} value={l.id}>
                    Before {l.name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          ) : null}
          <label className="flex items-start gap-3 text-sm">
            <Switch checked={draft.canHoldProducts} onCheckedChange={(on) => setDraft({ ...draft, canHoldProducts: on })} aria-label="Items of this level can carry products" />
            <span>
              <span className="block font-medium">Items on this level can carry products</span>
              <span className="block text-xs text-muted-foreground">Usually the last level. It cannot be switched off while products are placed on its items.</span>
            </span>
          </label>
        </ActionDialog>
      ) : null}

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete the level “${toDelete?.name ?? ""}”?`}
        description="The levels below it move up one place. Only a level without items can be deleted."
        confirmLabel="Delete level"
        successMessage="Level deleted"
        onConfirm={async () => {
          const res = await deleteLevelAction(toDelete?.id);
          if (res.ok) router.refresh();
          return res;
        }}
      />
    </SectionCard>
  );
}
