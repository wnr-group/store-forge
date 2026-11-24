"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteCampaignAction, getCampaignAction, setCampaignStatusAction } from "@/app/(dashboard)/dashboard/marketing/campaigns/actions";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import type { CampaignDetailApi, CampaignStatusApi } from "@/lib/api/endpoints/marketing-api";
import { campaignActions } from "@/lib/marketing/labels";
import { CampaignDialog, type CampaignDialogContext } from "./campaign-dialog";

/** "Create campaign" button for the list page. */
export function AddCampaignButton({ ctx }: { ctx: CampaignDialogContext }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus aria-hidden /> Create campaign
      </Button>
      {open ? <CampaignDialog open onOpenChange={setOpen} ctx={ctx} /> : null}
    </>
  );
}

/** One campaign's controls: the moves its status allows, edit and delete. Completing is final, so it asks first. */
export function CampaignRowActions({ id, name, status, canManage, ctx }: { id: string; name: string; status: CampaignStatusApi; canManage: boolean; ctx: CampaignDialogContext }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [detail, setDetail] = useState<CampaignDetailApi | null>(null);
  const [completing, setCompleting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const move = (to: CampaignStatusApi) =>
    start(async () => {
      const res = await setCampaignStatusAction(id, to);
      if (!res.ok) return void toast.error(res.error);
      toast.success(to === "active" ? `${name} is live` : to === "paused" ? `${name} is paused` : `${name} is completed`);
      router.refresh();
    });
  const edit = () =>
    start(async () => {
      const res = await getCampaignAction(id);
      if (!res.ok || !res.data) return void toast.error(res.ok ? "That campaign no longer exists." : res.error);
      setDetail(res.data);
    });

  if (!canManage) return null;
  return (
    <div className="flex items-center justify-end gap-1">
      {campaignActions(status).map((a) => (
        <Button key={a.to} variant="outline" size="sm" disabled={pending} onClick={() => (a.to === "completed" ? setCompleting(true) : move(a.to))}>
          {a.label}
        </Button>
      ))}
      {status !== "completed" ? (
        <Button variant="ghost" size="icon-sm" onClick={edit} disabled={pending} aria-label={`Edit ${name}`}>
          <Pencil aria-hidden />
        </Button>
      ) : null}
      <Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive" onClick={() => setDeleting(true)} disabled={pending} aria-label={`Delete ${name}`}>
        <Trash2 aria-hidden />
      </Button>
      {detail ? <CampaignDialog key={detail.id} open onOpenChange={(o) => !o && setDetail(null)} campaign={detail} ctx={ctx} /> : null}
      <ConfirmDialog
        open={completing}
        onOpenChange={setCompleting}
        title={`Complete ${name}?`}
        description="A completed campaign cannot be started again and can no longer be edited. Its discount codes stop working. Its results stay on this page."
        confirmLabel="Complete campaign"
        successMessage="Campaign completed"
        onConfirm={async () => {
          const res = await setCampaignStatusAction(id, "completed");
          if (res.ok) router.refresh();
          return res;
        }}
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${name}?`}
        description="The campaign is removed. Its discount codes are kept, but they no longer belong to a campaign, so they work on their own settings again."
        confirmLabel="Delete campaign"
        successMessage="Campaign deleted"
        onConfirm={async () => {
          const res = await deleteCampaignAction(id);
          if (res.ok) router.refresh();
          return res;
        }}
      />
    </div>
  );
}
