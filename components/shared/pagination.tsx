import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = { page: number; pageSize: number; total: number; basePath: string; params: Record<string, string | undefined> };

function href(basePath: string, params: Props["params"], page: number) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v && v !== "all" && k !== "page") qs.set(k, v);
  if (page > 1) qs.set("page", String(page));
  const s = qs.toString();
  return s ? `${basePath}?${s}` : basePath;
}

/** URL-driven pagination: works without JavaScript and keeps filters in the link. */
export function Pagination({ page, pageSize, total, basePath, params }: Props) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const link = "size-8";
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 pt-4 text-sm text-muted-foreground">
      <p>
        {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-1">
        <Link
          href={href(basePath, params, page - 1)}
          aria-label="Previous page"
          aria-disabled={page <= 1}
          tabIndex={page <= 1 ? -1 : undefined}
          className={cn(buttonVariants({ variant: "outline", size: "icon" }), link, page <= 1 && "pointer-events-none opacity-40")}
        >
          <ChevronLeft aria-hidden />
        </Link>
        <span className="px-2 tabular-nums">
          {page} / {pages}
        </span>
        <Link
          href={href(basePath, params, page + 1)}
          aria-label="Next page"
          aria-disabled={page >= pages}
          tabIndex={page >= pages ? -1 : undefined}
          className={cn(buttonVariants({ variant: "outline", size: "icon" }), link, page >= pages && "pointer-events-none opacity-40")}
        >
          <ChevronRight aria-hidden />
        </Link>
      </div>
    </nav>
  );
}
