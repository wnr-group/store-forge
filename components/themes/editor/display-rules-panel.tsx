"use client";

import { CircleAlert } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { t } from "@/lib/i18n/messages";
import type { ComponentNode } from "@/lib/templates/document";
import type { DisplayRules, DisplayState } from "@/lib/templates/display-rules";
import { buildDisplay, DEVICE_KEYS, deviceOf, displayIssues, displayState, effectiveDevices, scheduleOf, supportsDisplayRules, type DeviceFlags } from "@/lib/themes/editor/display-state";
import { utcIsoToZonedLocal, zonedLocalToUtcIso } from "@/lib/themes/editor/display-time";
import { cn } from "@/lib/utils";

/** Whether the "When to show" panel is offered: only where Studio is on, and only for a section or block whose manifest supports display rules. */
export const showsDisplayPanel = (studioEnabled: boolean, kind: "section" | "block", type: string): boolean => studioEnabled && supportsDisplayRules(kind, type);

const STATE_CLASS: Record<DisplayState, string> = {
  always: "bg-muted text-muted-foreground",
  upcoming: "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200",
  active: "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200",
  expired: "bg-red-100 text-red-900 dark:bg-red-500/20 dark:text-red-200",
};

type Props = {
  node: Pick<ComponentNode, "display" | "settings">;
  disabled: boolean;
  /** The store's IANA time zone, when the editor has it. Schedules are written on this clock. */
  timezone: string | null | undefined;
  /** The preview clock (epoch ms): the real time, or the "Preview as of" time. The state chip is computed against it. */
  nowMs: number;
  onChange: (display: DisplayRules | undefined) => void;
};

/**
 * "When to show": an optional start and end (on the store's clock, stored as UTC instants), the devices the element is shown on, and
 * the state it is in right now. Device visibility here is authoritative (see lib/themes/editor/display-state.ts).
 */
export function DisplayRulesPanel({ node, disabled, timezone, nowMs, onChange }: Props) {
  const ids = useId();
  const [fieldError, setFieldError] = useState<{ startsAt?: string; endsAt?: string }>({});
  const schedule = scheduleOf(node.display);
  const devices = effectiveDevices(node);
  const zone = timezone || schedule?.timezone || "UTC";
  const zoneLabel = timezone || schedule?.timezone || t("display.timezone.fallback");
  const state = displayState(node.display, nowMs);
  const issues = displayIssues(node.display);
  const allOff = deviceOf(node.display) !== undefined && !devices.desktop && !devices.tablet && !devices.mobile;
  const knownZone = timezone || schedule?.timezone ? zone : undefined;

  const write = (next: { startsAt?: string; endsAt?: string }, nextDevices: DeviceFlags) => onChange(buildDisplay({ ...next, timezone: knownZone }, nextDevices));

  const setBound = (key: "startsAt" | "endsAt", local: string) => {
    const current = { startsAt: schedule?.startsAt, endsAt: schedule?.endsAt };
    if (local === "") {
      setFieldError((e) => ({ ...e, [key]: undefined }));
      write({ ...current, [key]: undefined }, devices);
      return;
    }
    const iso = zonedLocalToUtcIso(local, zone);
    if (iso === null) {
      setFieldError((e) => ({ ...e, [key]: t("display.error.nonexistentTime") }));
      return;
    }
    setFieldError((e) => ({ ...e, [key]: undefined }));
    write({ ...current, [key]: iso }, devices);
  };

  const setDevice = (key: (typeof DEVICE_KEYS)[number], on: boolean) => write({ startsAt: schedule?.startsAt, endsAt: schedule?.endsAt }, { ...devices, [key]: on });

  const bound = (key: "startsAt" | "endsAt", label: string) => {
    const value = schedule?.[key] === undefined ? "" : (utcIsoToZonedLocal(schedule[key], zone) ?? "");
    const error = fieldError[key];
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={`${ids}-${key}`} className="text-sm font-medium">{label}</label>
          {value ? <Button type="button" variant="ghost" size="xs" disabled={disabled} onClick={() => setBound(key, "")}>{t("display.schedule.clear")}</Button> : null}
        </div>
        <Input id={`${ids}-${key}`} type="datetime-local" value={value} disabled={disabled} aria-invalid={error ? true : undefined} onChange={(e) => setBound(key, e.target.value)} />
        {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
      </div>
    );
  };

  return (
    <section aria-label={t("display.panel.title")} className="space-y-4 rounded-xl border bg-background/60 p-3.5">
      <header className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{t("display.panel.title")}</h3>
          <span data-display-state={state} className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", STATE_CLASS[state])}>{t(`display.state.${state}`)}</span>
        </div>
        <p className="text-xs text-muted-foreground">{t("display.panel.help")}</p>
      </header>

      <div className="space-y-3">
        {bound("startsAt", t("display.schedule.start"))}
        {bound("endsAt", t("display.schedule.end"))}
        <p className="text-xs text-muted-foreground">{t("display.timezone.label")}: <span data-display-timezone className="font-medium text-foreground">{zoneLabel}</span></p>
      </div>

      <fieldset className="space-y-2.5" disabled={disabled}>
        <legend className="mb-1 text-sm font-medium">{t("display.device.label")}</legend>
        {DEVICE_KEYS.map((key) => (
          <div key={key} className="flex items-center justify-between gap-3">
            <label htmlFor={`${ids}-${key}`} className="text-sm">{t(`display.device.${key}`)}</label>
            <Switch id={`${ids}-${key}`} checked={devices[key]} disabled={disabled} onCheckedChange={(on) => setDevice(key, on)} />
          </div>
        ))}
        <p className="text-xs text-muted-foreground">{t("display.device.footnote")}</p>
      </fieldset>

      {allOff ? (
        <p role="alert" className="flex items-start gap-1.5 rounded-md bg-amber-50 px-2.5 py-2 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {t("display.device.noneVisible")}
        </p>
      ) : null}
      {issues.filter((m) => m !== t("display.device.noneVisible")).map((message) => (
        <p key={message} role="alert" className="flex items-start gap-1.5 text-xs text-destructive">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {message}
        </p>
      ))}
    </section>
  );
}
