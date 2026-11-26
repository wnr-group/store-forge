"use client";

import { useState } from "react";
import { saveIntegrationAction } from "@/app/(dashboard)/dashboard/integrations/actions";
import { ActionDialog } from "@/components/shared/action-dialog";
import { FormField } from "@/components/shared/form-field";
import { Input } from "@/components/ui/input";
import { GA4_MEASUREMENT_ID } from "@/lib/tracking/events";

/** Google Analytics 4 settings: one Measurement ID. Saving checks it with the same rules the API uses, then validates it. */
export function Ga4Form({ open, onOpenChange, measurementId, configured }: { open: boolean; onOpenChange: (open: boolean) => void; measurementId: string; configured: boolean }) {
  const [id, setId] = useState(measurementId);
  const [error, setError] = useState<string | null>(null);
  const normalized = id.trim().toUpperCase();

  const submit = async () => {
    if (!GA4_MEASUREMENT_ID.test(normalized)) {
      const message = normalized.startsWith("UA-") ? "That is a Universal Analytics ID. Use a GA4 Measurement ID that starts with G-." : "Enter a Measurement ID like G-ABCDE12345 (G- and 10 letters or digits).";
      setError(message);
      return { ok: false as const, error: message };
    }
    setError(null);
    return saveIntegrationAction({ provider: "ga4", config: { measurementId: normalized } });
  };

  return (
    <ActionDialog
      key={`${open}`}
      open={open}
      onOpenChange={onOpenChange}
      title="Google Analytics 4"
      description="Connect your own Google Analytics property. Visits, product views, bag additions, checkouts and purchases of this store are sent to it, only for shoppers who agree to analytics."
      submitLabel={configured ? "Save changes" : "Save and validate"}
      success={configured ? "Google Analytics settings saved" : "Google Analytics saved. Switch it on when you are ready."}
      onSubmit={submit}
    >
      <FormField id="ga4-id" label="Measurement ID" required error={error ?? undefined} hint="In Google Analytics: Admin, Data streams, choose your web stream. The ID starts with G-.">
        <Input
          id="ga4-id"
          value={id}
          placeholder="G-XXXXXXXXXX"
          maxLength={20}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => {
            setId(e.target.value);
            setError(null);
          }}
          aria-invalid={Boolean(error)}
          aria-describedby="ga4-id-msg"
        />
      </FormField>
      {configured && normalized !== measurementId ? <p className="text-xs text-muted-foreground">Changing the ID switches Google Analytics off until you turn it on again.</p> : null}
    </ActionDialog>
  );
}
