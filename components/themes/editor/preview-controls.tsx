"use client";

import { Monitor, Smartphone, Tablet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { t } from "@/lib/i18n/messages";
import { utcIsoToZonedLocal, zonedLocalToUtcIso } from "@/lib/themes/editor/display-time";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ThemeFrame, type Device } from "../theme-frame";
import { type ComponentProps } from "react";

export const DEVICES: { id: Device; label: string; icon: typeof Monitor; width: number }[] = [
  { id: "desktop", label: "Desktop", icon: Monitor, width: 1280 },
  { id: "tablet", label: "Tablet", icon: Tablet, width: 820 },
  { id: "mobile", label: "Mobile", icon: Smartphone, width: 390 },
];
export const ZOOMS = [{ label: "Fit", value: 0 }, { label: "50%", value: 0.5 }, { label: "75%", value: 0.75 }, { label: "100%", value: 1 }, { label: "125%", value: 1.25 }];

type FrameProps = Pick<ComponentProps<typeof ThemeFrame>, "data" | "theme" | "groups" | "resource" | "previewNow">;

/**
 * "Preview as of...": shows the editor preview at a chosen date and time on the store clock, so a scheduled section can be checked
 * before it goes live. The value is a UTC instant (null = now). Editor only: the live store always uses the real time.
 */
export function PreviewAsOf({ value, timezone, onChange }: { value: string | null; timezone: string | null | undefined; onChange: (utcIso: string | null) => void }) {
  const zone = timezone || "UTC";
  const local = value === null ? "" : (utcIsoToZonedLocal(value, zone) ?? "");
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label={t("display.preview.label")} title={t("display.preview.help")}>
      <label htmlFor="preview-as-of" className="text-xs whitespace-nowrap text-muted-foreground">{t("display.preview.label")}</label>
      <Input id="preview-as-of" type="datetime-local" value={local} className="h-8 w-44 text-xs" onChange={(e) => onChange(e.target.value === "" ? null : zonedLocalToUtcIso(e.target.value, zone))} />
      {value !== null ? <Button type="button" size="xs" variant="ghost" onClick={() => onChange(null)}>{t("display.preview.reset")}</Button> : null}
    </div>
  );
}

/** The full-screen draft preview with its own device switcher. */
export function DraftPreviewDialog({ previewing, setPreviewing, device, setDevice, frameDocument, frameProps }: {
  previewing: boolean;
  setPreviewing: (open: boolean) => void;
  device: Device;
  setDevice: (d: Device) => void;
  frameDocument: ComponentProps<typeof ThemeFrame>["document"];
  frameProps: FrameProps;
}) {
  return (
      <Dialog open={previewing} onOpenChange={setPreviewing}>
        <DialogContent className="flex h-[calc(100dvh-2rem)] max-w-none flex-col gap-0 p-0 sm:max-w-[min(1400px,calc(100%-2rem))]">
          <DialogHeader className="flex flex-row items-center justify-between gap-3 border-b p-4 pr-12">
            <div>
              <DialogTitle>Draft preview</DialogTitle>
              <DialogDescription>How your store looks with your latest changes. Only you and your team can see this; it is not published.</DialogDescription>
            </div>
            <div className="flex rounded-md border p-0.5" role="group" aria-label="Preview size">
              {DEVICES.map(({ id, label, icon: Icon }) => (
                <Button key={id} size="icon-sm" variant={device === id ? "secondary" : "ghost"} aria-label={label} aria-pressed={device === id} onClick={() => setDevice(id)}><Icon aria-hidden /></Button>
              ))}
            </div>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto bg-muted/60 p-4">
            <div className={cn("mx-auto overflow-hidden rounded-md border bg-white shadow-sm", device === "desktop" ? "w-full" : device === "tablet" ? "w-[820px] max-w-full" : "w-[390px] max-w-full")}>
              <ThemeFrame document={frameDocument} device={device} mode="preview" {...frameProps} />
            </div>
          </div>
        </DialogContent>
      </Dialog>
  );
}
