"use client";

import { useState } from "react";
import { saveIntegrationAction } from "@/app/(dashboard)/dashboard/integrations/actions";
import { ActionDialog } from "@/components/shared/action-dialog";
import { FormField } from "@/components/shared/form-field";
import { Input } from "@/components/ui/input";
import { META_PIXEL_ID } from "@/lib/tracking/events";

/** Meta Pixel settings: one Pixel ID. Saving checks it with the same rules the API uses, then validates it. */
export function MetaPixelForm({ open, onOpenChange, pixelId, configured }: { open: boolean; onOpenChange: (open: boolean) => void; pixelId: string; configured: boolean }) {
  const [id, setId] = useState(pixelId);
  const [error, setError] = useState<string | null>(null);
  // A pasted ID often carries spaces or dashes that are not part of it.
  const normalized = id.replace(/[\s-]/g, "");

  const submit = async () => {
    if (!META_PIXEL_ID.test(normalized)) {
      const message = /^act_/i.test(normalized) ? "That is an ad account ID. Use the Pixel ID from Events Manager." : "Enter your Pixel ID: a number of 15 or 16 digits.";
      setError(message);
      return { ok: false as const, error: message };
    }
    setError(null);
    return saveIntegrationAction({ provider: "meta_pixel", config: { pixelId: normalized } });
  };

  return (
    <ActionDialog
      key={`${open}`}
      open={open}
      onOpenChange={onOpenChange}
      title="Meta Pixel"
      description="Connect your own Meta Pixel. Product views, bag additions, checkouts and purchases of this store are sent to it, only for shoppers who agree to analytics."
      submitLabel={configured ? "Save changes" : "Save and validate"}
      success={configured ? "Meta Pixel settings saved" : "Meta Pixel saved. Switch it on when you are ready."}
      onSubmit={submit}
    >
      <FormField id="meta-pixel-id" label="Pixel ID" required error={error ?? undefined} hint="In Meta Events Manager, choose your data source (the Pixel). The ID is the number under its name.">
        <Input
          id="meta-pixel-id"
          value={id}
          placeholder="123456789012345"
          inputMode="numeric"
          maxLength={24}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => {
            setId(e.target.value);
            setError(null);
          }}
          aria-invalid={Boolean(error)}
          aria-describedby="meta-pixel-id-msg"
        />
      </FormField>
      {configured && normalized !== pixelId ? <p className="text-xs text-muted-foreground">Changing the ID switches the Meta Pixel off until you turn it on again.</p> : null}
    </ActionDialog>
  );
}
