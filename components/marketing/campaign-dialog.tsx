"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { saveCampaignAction } from "@/app/(dashboard)/dashboard/marketing/campaigns/actions";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { CampaignDetailApi } from "@/lib/api/endpoints/marketing-api";
import { campaignFormToPayload, isoToZonedLocal, type CampaignFormValues } from "@/lib/marketing/forms";
import { TargetPicker, type PickOption } from "./target-picker";

export type CampaignDialogContext = { timeZone: string; products: PickOption[]; collections: PickOption[]; discounts: PickOption[]; catalogAccess: boolean };

const fromCampaign = (c: CampaignDetailApi | undefined, ctx: CampaignDialogContext): CampaignFormValues =>
  c
    ? { name: c.name, description: c.description ?? "", startsAt: isoToZonedLocal(c.startsAt, ctx.timeZone), endsAt: isoToZonedLocal(c.endsAt, ctx.timeZone), productIds: c.products.map((p) => p.id), collectionIds: c.collections.map((x) => x.id), discountIds: c.discounts.map((d) => d.id) }
    : { name: "", description: "", startsAt: "", endsAt: "", productIds: [], collectionIds: [], discountIds: [] };

/** Create or edit a campaign. Remount (key) per campaign so the fields reset. */
export function CampaignDialog({ open, onOpenChange, campaign, ctx }: { open: boolean; onOpenChange: (open: boolean) => void; campaign?: CampaignDetailApi; ctx: CampaignDialogContext }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [v, setV] = useState<CampaignFormValues>(() => fromCampaign(campaign, ctx));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const editing = !!campaign;
  const patch = (p: Partial<CampaignFormValues>) => {
    setV((x) => ({ ...x, ...p }));
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !(k in p))));
  };

  const submit = () => {
    setFormError(null);
    const r = campaignFormToPayload(v, { timeZone: ctx.timeZone });
    if (!r.ok) {
      setErrors(r.errors);
      setFormError("Please correct the highlighted fields.");
      return;
    }
    start(async () => {
      const res = await saveCampaignAction(campaign?.id ?? null, r.value);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        setFormError(res.error);
        return;
      }
      toast.success(editing ? "Campaign updated" : "Campaign created as a draft. Activate it when you are ready.");
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${campaign.name}` : "Create campaign"}</DialogTitle>
          <DialogDescription>A campaign groups discount codes for one promotion. Its codes work only while the campaign is live. Nothing is sent to customers from a campaign.</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {formError ? (
            <p role="alert" className="text-sm text-error">
              {formError}
            </p>
          ) : null}
          <FormField id="cp-name" label="Name" required error={errors.name}>
            <Input id="cp-name" value={v.name} onChange={(e) => patch({ name: e.target.value })} disabled={pending} maxLength={120} autoFocus={!editing} aria-invalid={Boolean(errors.name)} aria-describedby="cp-name-msg" />
          </FormField>
          <FormField id="cp-desc" label="Description" optional error={errors.description} hint="Only you see this.">
            <Textarea id="cp-desc" rows={2} value={v.description} onChange={(e) => patch({ description: e.target.value })} disabled={pending} maxLength={2000} aria-describedby="cp-desc-msg" />
          </FormField>
          <div className="grid gap-x-4 sm:grid-cols-2">
            <FormField id="cp-start" label="Starts" optional error={errors.startsAt} hint={`In your store time zone (${ctx.timeZone}).`}>
              <Input id="cp-start" type="datetime-local" value={v.startsAt} onChange={(e) => patch({ startsAt: e.target.value })} disabled={pending} aria-invalid={Boolean(errors.startsAt)} aria-describedby="cp-start-msg" />
            </FormField>
            <FormField id="cp-end" label="Ends" optional error={errors.endsAt} hint="After this its codes stop working.">
              <Input id="cp-end" type="datetime-local" value={v.endsAt} onChange={(e) => patch({ endsAt: e.target.value })} disabled={pending} aria-invalid={Boolean(errors.endsAt)} aria-describedby="cp-end-msg" />
            </FormField>
          </div>
          <TargetPicker id="cp-codes" label="Discount codes in this campaign" options={ctx.discounts} value={v.discountIds} onChange={(discountIds) => patch({ discountIds })} error={errors.discountIds} disabled={pending} emptyText="Create a discount code first, then add it here." />
          <TargetPicker id="cp-products" label="Products it is about" options={ctx.products} value={v.productIds} onChange={(productIds) => patch({ productIds })} disabled={pending} emptyText={ctx.catalogAccess ? "You have no products yet." : "Choosing products needs access to products and inventory."} />
          <TargetPicker id="cp-collections" label="Collections it is about" options={ctx.collections} value={v.collectionIds} onChange={(collectionIds) => patch({ collectionIds })} disabled={pending} emptyText={ctx.catalogAccess ? "You have no collections yet." : "Choosing collections needs access to products and inventory."} />
          <p className="text-xs text-muted-foreground">Products and collections describe what the promotion is about. What each discount code actually applies to is set on the code.</p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} {pending ? "Saving…" : editing ? "Save changes" : "Create campaign"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
