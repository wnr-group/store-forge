"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

export type FilterDef = { key: string; label: string; options: { value: string; label: string }[] };

type Props = { searchPlaceholder: string; filters?: FilterDef[]; sortOptions?: { value: string; label: string }[] };

/**
 * URL-driven filters: every change rewrites the query string (resetting to page 1), and the
 * server component re-renders with the new results. Nothing is filtered in the browser.
 */
export function ListFilters({ searchPlaceholder, filters = [], sortOptions }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const push = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "" || v === "all") next.delete(k);
      else next.set(k, v);
    }
    next.delete("page");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const onSearch = (value: string) => {
    setQ(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => push({ q: value.trim() }), 300);
  };

  const sortValue = params.get("sort") ? `${params.get("sort")}:${params.get("dir") ?? "desc"}` : sortOptions?.[0]?.value;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative min-w-52 flex-1 sm:max-w-xs">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input value={q} onChange={(e) => onSearch(e.target.value)} placeholder={searchPlaceholder} aria-label={searchPlaceholder} className="pr-8 pl-8" />
        {q ? (
          <button type="button" onClick={() => onSearch("")} aria-label="Clear search" className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground">
            <X className="size-3.5" aria-hidden />
          </button>
        ) : null}
      </div>
      {filters.map((f) => (
        <div key={f.key} className="w-auto min-w-32">
          <NativeSelect aria-label={f.label} value={params.get(f.key) ?? "all"} onChange={(e) => push({ [f.key]: e.target.value })}>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </div>
      ))}
      {sortOptions ? (
        <div className="w-auto min-w-36 sm:ml-auto">
          <NativeSelect
            aria-label="Sort by"
            value={sortValue}
            onChange={(e) => {
              const [sort, dir] = e.target.value.split(":");
              push({ sort, dir });
            }}
          >
            {sortOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </div>
      ) : null}
    </div>
  );
}
