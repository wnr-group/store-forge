"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { NativeSelect } from "@/components/ui/native-select";

/** "Rows per page" for URL-driven lists: sets `pageSize` and goes back to page 1, keeping every other filter. */
export function PageSizeSelect({ value, options }: { value: number; options: readonly number[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  return (
    <label className="flex items-center gap-2">
      <span className="hidden sm:inline">Rows per page</span>
      <div className="w-20">
        <NativeSelect
          aria-label="Rows per page"
          value={String(value)}
          onChange={(e) => {
            const next = new URLSearchParams(params.toString());
            next.set("pageSize", e.target.value);
            next.delete("page");
            router.replace(`${pathname}?${next.toString()}`, { scroll: false });
          }}
        >
          {options.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </NativeSelect>
      </div>
    </label>
  );
}
