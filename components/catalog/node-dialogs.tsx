"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";
import { createNodeAction, listNodesAction, moveNodeAction, updateNodeAction } from "@/app/(dashboard)/dashboard/catalog/actions";
import { ActionDialog } from "@/components/shared/action-dialog";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { parentLevel } from "@/lib/catalog/tree";
import type { CatalogLevel, CatalogNode, CatalogPage, CatalogStatus } from "@/lib/catalog/types";

type NodeDraft = { name: string; slug: string; description: string; status: CatalogStatus; seoTitle: string; seoDescription: string };
const blank: NodeDraft = { name: "", slug: "", description: "", status: "draft", seoTitle: "", seoDescription: "" };

const fromNode = (n: CatalogNode): NodeDraft => ({ name: n.name, slug: n.slug, description: n.description ?? "", status: n.status, seoTitle: n.seoTitle ?? "", seoDescription: n.seoDescription ?? "" });

/**
 * Create or edit one item. A new item goes on the level right after its parent's level (level 1 with no parent); the API decides that,
 * the dialog only says where it will land. Without an address one is made from the name.
 */
export function NodeFormDialog({ target, level, onClose }: { target: { mode: "create"; parent: CatalogNode | null } | { mode: "edit"; node: CatalogNode }; level: CatalogLevel | null; onClose: () => void }) {
  const [v, setV] = useState<NodeDraft>(target.mode === "edit" ? fromNode(target.node) : blank);
  const set = <K extends keyof NodeDraft>(key: K, value: NodeDraft[K]) => setV((prev) => ({ ...prev, [key]: value }));
  const levelName = level?.name ?? "item";

  const submit = () => {
    const body = { name: v.name, slug: v.slug, description: v.description, status: v.status, seoTitle: v.seoTitle, seoDescription: v.seoDescription };
    return target.mode === "edit" ? updateNodeAction(target.node.id, body) : createNodeAction({ ...body, parentId: target.parent?.id ?? null });
  };

  return (
    <ActionDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={target.mode === "edit" ? `Edit ${target.node.name}` : `New ${levelName.toLowerCase()}`}
      description={target.mode === "edit" ? `A ${target.node.levelName.toLowerCase()} item. To put it under another parent, use Move.` : target.parent ? `It will be added under ${target.parent.name}.` : "It will be added at the top level."}
      submitLabel={target.mode === "edit" ? "Save changes" : `Add ${levelName.toLowerCase()}`}
      success={target.mode === "edit" ? "Saved" : "Item added"}
      onSubmit={submit}
      wide
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id="node-name" label="Name" required>
          <Input id="node-name" value={v.name} onChange={(e) => set("name", e.target.value)} maxLength={120} autoFocus />
        </FormField>
        <FormField id="node-slug" label="Address" optional hint="Used in the page address. Leave empty to make it from the name.">
          <Input id="node-slug" value={v.slug} onChange={(e) => set("slug", e.target.value)} maxLength={80} placeholder="e.g. rock-star" />
        </FormField>
      </div>
      <FormField id="node-description" label="Description" optional>
        <Textarea id="node-description" value={v.description} onChange={(e) => set("description", e.target.value)} maxLength={2000} rows={3} />
      </FormField>
      <FormField id="node-status" label="Visibility" hint={v.status === "active" ? "Shoppers can see it (once its parents and the catalog are active too)." : "A draft hides it, and everything below it, from shoppers."}>
        <NativeSelect id="node-status" value={v.status} onChange={(e) => set("status", e.target.value as CatalogStatus)}>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
        </NativeSelect>
      </FormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id="node-seo-title" label="SEO title" optional>
          <Input id="node-seo-title" value={v.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} maxLength={70} />
        </FormField>
        <FormField id="node-seo-description" label="SEO description" optional>
          <Input id="node-seo-description" value={v.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} maxLength={160} />
        </FormField>
      </div>
    </ActionDialog>
  );
}

type Candidate = CatalogNode;

/** Choose a new parent for an item: only items on the level just above it are valid, and the API refuses its own subtree. */
export function MoveNodeDialog({ node, levels, onClose }: { node: CatalogNode; levels: CatalogLevel[]; onClose: () => void }) {
  const above = parentLevel(levels, node);
  const [parentId, setParentId] = useState<string | null>(node.parentId);
  const [search, setSearch] = useState("");
  const [data, setData] = useState<CatalogPage<Candidate> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(above !== null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(0);
  const aboveId = above?.id ?? null;

  /** A search or page change the merchant asked for. */
  const load = async (term: string, page: number) => {
    if (!aboveId) return;
    const ticket = ++latest.current;
    setLoading(true);
    setError(null);
    const res = await listNodesAction({ levelId: aboveId, search: term || undefined, page, limit: 20 });
    if (ticket !== latest.current) return;
    setLoading(false);
    if (res.ok && res.data) setData(res.data as CatalogPage<Candidate>);
    else if (!res.ok) setError(res.error);
  };

  // The first page, read when the dialog opens. State is set only in the answer's callback.
  useEffect(() => {
    if (!aboveId) return;
    let live = true;
    void listNodesAction({ levelId: aboveId, page: 1, limit: 20 }).then((res) => {
      if (!live || latest.current !== 0) return; // closed, or the merchant already searched
      setLoading(false);
      if (res.ok && res.data) setData(res.data as CatalogPage<Candidate>);
      else if (!res.ok) setError(res.error);
    });
    return () => {
      live = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [aboveId]);

  const onSearch = (value: string) => {
    setSearch(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void load(value.trim(), 1), 300);
  };

  return (
    <ActionDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Move ${node.name}`}
      description={above ? `Choose the ${above.name.toLowerCase()} it should sit under. Everything below it moves with it.` : "Top-level items have no parent. Use the arrows next to an item to change its order."}
      submitLabel="Move here"
      success="Moved"
      onSubmit={() => (parentId === node.parentId || parentId === null ? Promise.resolve({ ok: false as const, error: "Choose a different parent first." }) : moveNodeAction(node.id, { parentId }))}
    >
      {above ? (
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input aria-label={`Search ${above.name}`} value={search} onChange={(e) => onSearch(e.target.value)} placeholder={`Search ${above.name.toLowerCase()}`} className="pl-8" />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-error">
              {error}
            </p>
          ) : null}
          <ul className="max-h-60 divide-y overflow-y-auto rounded-md border" role="radiogroup" aria-label={`New ${above.name.toLowerCase()}`} aria-busy={loading}>
            {loading && !data ? (
              <li className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden /> Loading…
              </li>
            ) : null}
            {data && data.items.length === 0 ? <li className="px-3 py-4 text-center text-sm text-muted-foreground">Nothing matches.</li> : null}
            {data?.items.map((c) => (
              <li key={c.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50">
                  <input type="radio" name="new-parent" checked={parentId === c.id} onChange={() => setParentId(c.id)} className="size-4 accent-primary" />
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  {c.id === node.parentId ? <span className="text-xs text-muted-foreground">Current</span> : null}
                </label>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{data ? `${data.total} ${data.total === 1 ? "item" : "items"}` : ""}</span>
            <div className="flex items-center gap-1">
              <Button type="button" variant="outline" size="icon-sm" aria-label="Previous page" disabled={loading || !data || data.page <= 1} onClick={() => data && void load(search.trim(), data.page - 1)}>
                <ChevronLeft aria-hidden />
              </Button>
              <span className="px-1 tabular-nums">
                {data?.page ?? 1} / {data?.totalPages ?? 1}
              </span>
              <Button type="button" variant="outline" size="icon-sm" aria-label="Next page" disabled={loading || !data || data.page >= data.totalPages} onClick={() => data && void load(search.trim(), data.page + 1)}>
                <ChevronRight aria-hidden />
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </ActionDialog>
  );
}
