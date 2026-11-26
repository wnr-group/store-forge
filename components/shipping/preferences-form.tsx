"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { savePreferencesAction } from "@/app/(dashboard)/dashboard/shipping/actions";
import { FormField } from "@/components/shared/form-field";
import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";

type Props = { selectionMode: "manual" | "automatic"; strategy: "lowest_cost" | "fastest" | "preferred"; activeCarrierCount: number; defaultCarrier: string | null; canManage: boolean };

const STRATEGY_HINT = {
  lowest_cost: "Books with the carrier quoting the lowest price.",
  fastest: "Books with the carrier promising the earliest delivery.",
  preferred: "Books with your default carrier whenever it can serve the address, otherwise the next best.",
} as const;

/** How a carrier is chosen when a shipment is booked. A carrier that cannot serve the PIN code is never chosen. */
export function PreferencesForm({ selectionMode, strategy, activeCarrierCount, defaultCarrier, canManage }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState(selectionMode);
  const [strat, setStrat] = useState(strategy);
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await savePreferencesAction({ selectionMode: mode, strategy: strat });
      if (!res.ok) return setError(res.error);
      toast.success("Carrier selection saved");
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit}>
      <SectionCard title="Carrier selection" description={`${activeCarrierCount} carrier${activeCarrierCount === 1 ? " is" : "s are"} turned on${defaultCarrier ? `; ${defaultCarrier} is your default` : ""}.`}>
        {error ? (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="pf-mode" label="When booking a shipment">
            <NativeSelect id="pf-mode" value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} disabled={pending || !canManage}>
              <option value="manual">I choose the carrier each time</option>
              <option value="automatic">Choose the carrier automatically</option>
            </NativeSelect>
          </FormField>
          <FormField id="pf-strategy" label="Automatic strategy" hint={STRATEGY_HINT[strat]}>
            <NativeSelect id="pf-strategy" value={strat} onChange={(e) => setStrat(e.target.value as typeof strat)} disabled={pending || !canManage || mode === "manual"}>
              <option value="lowest_cost">Lowest shipping cost</option>
              <option value="fastest">Fastest delivery</option>
              <option value="preferred">Preferred (default) carrier</option>
            </NativeSelect>
          </FormField>
        </div>
        {canManage ? (
          <div>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} {pending ? "Saving…" : "Save selection"}
            </Button>
          </div>
        ) : null}
      </SectionCard>
    </form>
  );
}
