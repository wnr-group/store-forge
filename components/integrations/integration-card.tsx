"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, CheckCircle2, Loader2, Megaphone, XCircle } from "lucide-react";
import { toast } from "sonner";
import { removeIntegrationAction, setIntegrationEnabledAction, testIntegrationAction } from "@/app/(dashboard)/dashboard/integrations/actions";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import type { IntegrationEventApi, IntegrationTestApi } from "@/lib/api/endpoints/integrations-api";
import { Ga4Form } from "./ga4-form";
import { MetaPixelForm } from "./meta-pixel-form";

export type IntegrationView = {
  provider: string;
  name: string;
  description: string;
  configured: boolean;
  enabled: boolean;
  validationStatus: "unverified" | "valid" | "invalid" | null;
  validationError: string | null;
  config: Record<string, string>;
  /** The name and value of the public identifier this provider is set up with (e.g. Measurement ID, Pixel ID). */
  identifierLabel: string;
  identifierKey: string;
  /** Already formatted in the store's time zone, e.g. "24 Nov 2026". */
  updatedLabel: string | null;
  updatedByYou: boolean;
  history: (Omit<IntegrationEventApi, "createdAt"> & { when: string })[];
};

const ACTION_LABELS: Record<string, string> = {
  configure: "Settings saved",
  update: "Settings changed",
  validate: "Validated",
  validate_failed: "Test failed",
  enable: "Switched on",
  disable: "Switched off",
  remove: "Removed",
};

/** The configuration state, in words (colour is never the only signal). */
function configuration(v: IntegrationView): { tone: "active" | "draft" | "warning"; label: string } {
  if (!v.configured) return { tone: "draft", label: "Not configured" };
  if (v.validationStatus === "valid") return { tone: "active", label: "Configured and validated" };
  return { tone: "warning", label: "Needs validation: save the settings again" };
}

/** One integration: its status, an on/off switch, configure, test and remove, and what recently happened to it. */
export function IntegrationCard({ view, canManage }: { view: IntegrationView; canManage: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [configuring, setConfiguring] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [result, setResult] = useState<IntegrationTestApi | null>(null);
  const [testing, setTesting] = useState(false);
  const config = configuration(view);
  const canSwitch = canManage && view.configured && view.validationStatus === "valid";

  const toggle = (enabled: boolean) =>
    start(async () => {
      const res = await setIntegrationEnabledAction({ provider: view.provider, enabled });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(enabled ? `${view.name} is on. Shoppers who agree to analytics are measured.` : `${view.name} is off.`);
      router.refresh();
    });

  const test = async () => {
    setTesting(true);
    setResult(null);
    const res = await testIntegrationAction({ provider: view.provider });
    setTesting(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    if (res.data) setResult(res.data);
    router.refresh();
  };

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-secondary text-muted-foreground" aria-hidden>
            {view.provider === "meta_pixel" ? <Megaphone className="size-4" /> : <BarChart3 className="size-4" />}
          </span>
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-sm font-semibold">{view.name}</CardTitle>
            <CardDescription>{view.description}</CardDescription>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <StatusBadge tone={view.enabled ? "active" : "draft"}>{view.enabled ? "On" : "Off"}</StatusBadge>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{view.enabled ? "Switch off" : "Switch on"}</span>
            <Switch checked={view.enabled} onCheckedChange={toggle} disabled={!canSwitch || pending} aria-label={`${view.name} on or off`} />
          </label>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">Configuration</dt>
            <dd className="mt-1">
              <StatusBadge tone={config.tone}>{config.label}</StatusBadge>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{view.identifierLabel}</dt>
            <dd className="mt-1 break-all font-mono text-[13px]">{view.config[view.identifierKey] ?? "None"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Last updated</dt>
            <dd className="mt-1">{view.updatedLabel ? `${view.updatedLabel}${view.updatedByYou ? " by you" : ""}` : "Never"}</dd>
          </div>
        </dl>

        {!view.configured ? <p className="text-sm text-muted-foreground">Add your {view.identifierLabel}, then switch it on. Nothing is sent to {view.name} until you do, and then only for shoppers who agree to analytics.</p> : null}

        <div className="flex flex-wrap gap-2">
          {canManage ? (
            <Button type="button" variant={view.configured ? "outline" : "default"} size="sm" onClick={() => setConfiguring(true)}>
              {view.configured ? "Configure" : "Set up"}
            </Button>
          ) : null}
          {canManage && view.configured ? (
            <>
              <Button type="button" variant="outline" size="sm" onClick={test} disabled={testing}>
                {testing ? <Loader2 className="animate-spin" aria-hidden /> : null} {testing ? "Testing…" : "Test"}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setRemoving(true)}>
                Remove
              </Button>
            </>
          ) : null}
        </div>

        {result ? (
          <div role="status" className="space-y-2 rounded-md border p-3 text-sm">
            <p className="font-medium">{result.ok ? "The test passed" : "The test found a problem"}</p>
            <ul className="space-y-1.5">
              {result.checks.map((c) => (
                <li key={c.name} className="flex items-start gap-2">
                  {c.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success-text" aria-label="Passed" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-label="Failed" />}
                  <span>
                    <span className="font-medium">{c.name}.</span> {c.message}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">{result.note}</p>
          </div>
        ) : null}

        {view.history.length > 0 ? (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Recent activity</summary>
            <ul className="mt-2 divide-y rounded-md border">
              {view.history.slice(0, 8).map((e, i) => (
                <li key={`${e.when}-${i}`} className="flex flex-wrap items-baseline justify-between gap-x-4 px-3 py-2">
                  <span>
                    {ACTION_LABELS[e.action] ?? e.action}
                    {e.note ? <span className="text-muted-foreground"> · {e.note}</span> : null}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {e.when}
                    {e.byYou ? " · you" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </CardContent>

      {view.provider === "ga4" ? <Ga4Form open={configuring} onOpenChange={setConfiguring} measurementId={view.config.measurementId ?? ""} configured={view.configured} /> : null}
      {view.provider === "meta_pixel" ? <MetaPixelForm open={configuring} onOpenChange={setConfiguring} pixelId={view.config.pixelId ?? ""} configured={view.configured} /> : null}
      <ConfirmDialog
        open={removing}
        onOpenChange={setRemoving}
        title={`Remove ${view.name}?`}
        description={`The saved ${view.identifierLabel} is deleted and your store stops sending data to ${view.name} right away. Data already sent stays there.`}
        confirmLabel="Remove"
        successMessage={`${view.name} removed`}
        onConfirm={async () => {
          const res = await removeIntegrationAction({ provider: view.provider });
          if (res.ok) router.refresh();
          return res;
        }}
      />
    </Card>
  );
}
