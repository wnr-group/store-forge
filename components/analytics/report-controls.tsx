"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The period and bucket size of a report. The report itself is read on the server for what the URL says, so nothing is filtered in
 * the browser. Empty dates mean the default (the last 30 days); the days are the store's days.
 */
export function ReportControls({ from, to, interval }: { from: string; to: string; interval: "day" | "week" | "month" }) {
  const router = useRouter();
  const pathname = usePathname();
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);
  const [i, setI] = useState(interval);
  const valid = DAY.test(f) && DAY.test(t) && f <= t;
  const apply = () => {
    if (!valid) return;
    const qs = new URLSearchParams({ from: f, to: t, interval: i });
    router.replace(`${pathname}?${qs}`, { scroll: false });
  };
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        apply();
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
      <label className="grid gap-1 text-xs text-muted-foreground">
        Group by
        <NativeSelect value={i} onChange={(e) => setI(e.target.value as typeof i)} className="w-32">
          <option value="day">Day</option>
          <option value="week">Week</option>
          <option value="month">Month</option>
        </NativeSelect>
      </label>
      <Button type="submit" variant="outline" disabled={!valid}>
        Show
      </Button>
      {!valid ? <p role="alert" className="text-xs text-error">Choose a start on or before the end.</p> : null}
    </form>
  );
}
