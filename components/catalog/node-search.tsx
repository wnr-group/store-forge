"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { listNodesAction } from "@/app/(dashboard)/dashboard/catalog/actions";
import { NodeRow, type NodeActions } from "@/components/catalog/node-tree";
import { Button } from "@/components/ui/button";
import type { CatalogLevel, CatalogNode, CatalogPage } from "@/lib/catalog/types";

/**
 * Search results for items, a page at a time from the server (the API searches names and addresses). The tree is for browsing; this
 * finds an item in a large catalog without opening branches. Mount it with `key={term}` so a new term starts on page 1.
 */
export function NodeSearchResults({ term, levels, canManage, canDelete, actions }: { term: string; levels: CatalogLevel[]; canManage: boolean; canDelete: boolean; actions: NodeActions }) {
  const [data, setData] = useState<CatalogPage<CatalogNode> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const latest = useRef(0);

  /** Reads one page; only the answer sets state, so it is safe to start from an effect. */
  const fetchPage = useCallback(
    async (page: number) => {
      const ticket = ++latest.current;
      const res = await listNodesAction({ search: term, page, limit: 20 });
      if (ticket !== latest.current) return;
      setLoading(false);
      if (res.ok && res.data) setData(res.data as CatalogPage<CatalogNode>);
      else if (!res.ok) setError(res.error);
    },
    [term],
  );

  const load = (page: number) => {
    setLoading(true);
    setError(null);
    void fetchPage(page);
  };

  // The first page of the results, read when the search starts. State is set only in the answer's callback.
  useEffect(() => {
    let live = true;
    void listNodesAction({ search: term, page: 1, limit: 20 }).then((res) => {
      if (!live || latest.current !== 0) return; // unmounted, or the merchant already turned a page
      setLoading(false);
      if (res.ok && res.data) setData(res.data as CatalogPage<CatalogNode>);
      else if (!res.ok) setError(res.error);
    });
    return () => {
      live = false;
    };
  }, [term]);

  return (
    <div className="space-y-3">
      {error ? (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      ) : null}
      <ul className="divide-y rounded-md border" aria-busy={loading} aria-label={`Items matching ${term}`}>
        {loading && !data ? (
          <li className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Searching…
          </li>
        ) : null}
        {!loading && data && data.items.length === 0 ? <li className="px-3 py-8 text-center text-sm text-muted-foreground">No items match “{term}”.</li> : null}
        {data?.items.map((n) => (
          <li key={n.id}>
            <NodeRow node={n} levels={levels} canManage={canManage} canDelete={canDelete} actions={actions} />
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span role="status">{data ? `${data.total} ${data.total === 1 ? "item" : "items"} found` : ""}</span>
        <div className="flex items-center gap-1">
          <Button type="button" variant="outline" size="icon-sm" aria-label="Previous page" disabled={loading || !data || data.page <= 1} onClick={() => data && load(data.page - 1)}>
            <ChevronLeft aria-hidden />
          </Button>
          <span className="px-1 tabular-nums">
            {data?.page ?? 1} / {data?.totalPages ?? 1}
          </span>
          <Button type="button" variant="outline" size="icon-sm" aria-label="Next page" disabled={loading || !data || data.page >= data.totalPages} onClick={() => data && load(data.page + 1)}>
            <ChevronRight aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}
