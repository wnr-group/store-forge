"use client";

import { RotateCcw } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import type { ElementSpec } from "@/lib/editor/adapter";
import {
  CAPABILITY_IDS, CAPABILITY_LABELS, fieldsFor, isEmptyStyle, resolveStyleValue,
  type ElementStyle, type StyleDevice, type StyleField, type StyleKey, type StyleLayer,
} from "@/lib/editor/style";
import type { SettingDescriptor } from "@/lib/templates/engine/descriptors";
import { SettingField } from "./setting-field";

const DEVICE_NOTE: Record<StyleDevice, string> = {
  base: "These changes apply on every screen size unless a smaller size overrides them.",
  tablet: "These changes apply on tablets and phones. Switch to Mobile to change phones only.",
  mobile: "These changes apply on phones only.",
};
const DEVICE_NAME: Record<StyleDevice, string> = { base: "Desktop", tablet: "Tablet", mobile: "Mobile" };

/** A style field as the settings-field descriptor the existing controls understand, so every control is the editor's own. */
export function toDescriptor(field: StyleField): SettingDescriptor {
  const c = field.control;
  const base = { id: field.key, label: field.label, default: null as unknown };
  switch (c.type) {
    case "color":
      return { ...base, type: "color" };
    case "toggle":
      return { ...base, type: "toggle", default: false };
    case "range":
      return { ...base, type: "range", min: c.min, max: c.max, step: c.step, unit: c.unit };
    case "select":
      return { ...base, type: "select", options: [{ label: "Theme default", value: "" }, ...c.options] };
    case "segmented":
      return { ...base, type: "select", options: [{ label: "Theme default", value: "" }, ...c.options] };
  }
}

type Props = {
  spec: ElementSpec;
  /** The element's own style. */
  style: ElementStyle;
  /** Styles it inherits from (a block's section), most general first. */
  inherited?: StyleLayer[];
  device: StyleDevice;
  disabled: boolean;
  onChange: (key: StyleKey, value: unknown) => void;
  onResetAll: () => void;
};

/**
 * The Style tab: only the controls the element's adapter says it supports, grouped by capability. A control shows the value
 * that applies on the device being previewed and where it comes from; changing it writes an override for that device, and
 * Reset removes just that override so the element inherits again.
 */
export function StylePanel({ spec, style, inherited = [], device, disabled, onChange, onResetAll }: Props) {
  const groups = useMemo(() => CAPABILITY_IDS.filter((id) => spec.capabilities.includes(id)).map((id) => ({ id, fields: fieldsFor([id]) })), [spec]);
  const layers: StyleLayer[] = [...inherited, { source: "element", style }];

  return (
    <div className="space-y-5">
      <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Editing for {DEVICE_NAME[device]}.</span> {DEVICE_NOTE[device]}
      </p>
      {groups.map(({ id, fields }) => (
        <fieldset key={id} className="space-y-4 rounded-xl border bg-background/60 p-3.5">
          <legend className="-ml-1 px-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{CAPABILITY_LABELS[id]}</legend>
          {fields.map((field) => {
            const resolved = resolveStyleValue(layers, field.key, device);
            const own = style[device]?.[field.key] !== undefined;
            const desc = toDescriptor(field);
            const isChoice = field.control.type === "select" || field.control.type === "segmented";
            return (
              <div key={`${device}.${field.key}`} className="space-y-1">
                <SettingField
                  descriptor={desc}
                  value={resolved.value === undefined ? (isChoice ? "" : undefined) : resolved.value}
                  disabled={disabled}
                  onChange={(v) => onChange(field.key, v === "" ? undefined : v)}
                />
                <div className="flex min-h-5 items-center justify-between text-[11px] text-muted-foreground">
                  <span>
                    {own ? "Changed here" : resolved.source ? (resolved.source === "element" ? `From ${DEVICE_NAME[resolved.device ?? "base"]} size` : `From the ${resolved.source}`) : "Using the theme"}
                  </span>
                  {own ? (
                    <Button type="button" variant="ghost" size="xs" disabled={disabled} onClick={() => onChange(field.key, undefined)} aria-label={`Reset ${field.label} to inherited`}>
                      <RotateCcw aria-hidden /> Reset
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </fieldset>
      ))}
      {!isEmptyStyle(style) ? (
        <Button type="button" variant="outline" size="sm" className="w-full" disabled={disabled} onClick={onResetAll}>
          <RotateCcw aria-hidden /> Reset all style changes
        </Button>
      ) : null}
    </div>
  );
}
