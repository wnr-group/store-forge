"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Picks the report period (inclusive dates). The report itself is read on the server for the chosen dates. */
export function TaxReportRange({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [f, setF] = useState(from.slice(0, 10));
  const [t, setT] = useState(to.slice(0, 10));
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(f) && /^\d{4}-\d{2}-\d{2}$/.test(t) && f <= t;
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) router.replace(`${pathname}?from=${f}&to=${t}`, { scroll: false });
      }}
    >
      <label className="grid gap-1 text-xs text-muted-foreground">
        From
        <Input type="date" value={f} max={t} onChange={(e) => setF(e.target.value)} className="w-40" />
      </label>
      <label className="grid gap-1 text-xs text-muted-foreground">
        To
        <Input type="date" value={t} min={f} onChange={(e) => setT(e.target.value)} className="w-40" />
      </label>
      <Button type="submit" variant="outline" disabled={!valid}>
        Update report
      </Button>
    </form>
  );
}
