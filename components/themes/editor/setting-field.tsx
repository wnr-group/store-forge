"use client";

import { createContext, useContext, useId, useRef, useState } from "react";
import { ImageUploader, type ImageItem } from "@/components/products/image-uploader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { SettingDescriptor } from "@/lib/templates/engine/descriptors";
import { cn } from "@/lib/utils";

type Props = {
  descriptor: SettingDescriptor;
  value: unknown;
  /** `undefined` removes the setting so its default applies again. */
  onChange: (value: unknown) => void;
  disabled?: boolean;
  error?: string;
};

const HEX = /^#[0-9a-fA-F]{6}$/;

/** The store's active collections, so a "collection" setting is a picker of real collections, not a typed id. */
export type CollectionChoice = { id: string; name: string; slug: string };
export const CollectionChoicesContext = createContext<CollectionChoice[]>([]);

/** One control for one setting, chosen by the descriptor's type. The descriptors are the single source of the rules. */
export function SettingField({ descriptor: d, value, onChange, disabled, error }: Props) {
  const id = useId();
  const current = value === undefined ? d.default : unwrapResponsive(value);
  const labelEl = <Label htmlFor={id} className="text-xs font-medium">{d.label}</Label>;
  const help = d.help ? <p className="text-xs text-muted-foreground">{d.help}</p> : null;
  const problem = error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null;

  const collections = useContext(CollectionChoicesContext);
  if (d.id === "collectionId" && d.type === "text") {
    const value = typeof current === "string" ? current : "";
    const known = collections.some((c) => c.slug === value || c.id === value);
    return (
      <div className="space-y-1.5">
        {labelEl}
        <NativeSelect id={id} value={value} disabled={disabled} aria-invalid={Boolean(error)} onChange={(e) => onChange(e.target.value)}>
          <option value="">Newest products (no collection)</option>
          {collections.map((c) => (
            <option key={c.id} value={c.slug}>{c.name}</option>
          ))}
          {value && !known ? <option value={value}>Removed collection</option> : null}
        </NativeSelect>
        <p className="text-xs text-muted-foreground">Shows the active products of this collection. Create collections under Catalog &gt; Collections.</p>
        {problem}
      </div>
    );
  }

  switch (d.type) {
    case "text":
    case "url":
      return (
        <div className="space-y-1.5">
          {labelEl}
          <Input
            id={id}
            value={typeof current === "string" ? current : ""}
            placeholder={d.placeholder ?? (d.type === "url" ? "https:// or /path" : undefined)}
            inputMode={d.type === "url" ? "url" : undefined}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            onChange={(e) => onChange(e.target.value)}
          />
          {help}{problem}
        </div>
      );
    case "textarea":
    case "richtext":
      return (
        <div className="space-y-1.5">
          {labelEl}
          <Textarea id={id} rows={d.type === "richtext" ? 5 : 3} value={typeof current === "string" ? current : ""} disabled={disabled} aria-invalid={Boolean(error)} onChange={(e) => onChange(e.target.value)} />
          {help}{problem}
        </div>
      );
    case "number":
      return (
        <div className="space-y-1.5">
          {labelEl}
          <Input
            id={id}
            type="number"
            min={d.min}
            max={d.max}
            step={d.step}
            value={typeof current === "number" ? current : ""}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            onChange={(e) => (e.target.value === "" ? onChange(undefined) : onChange(Number(e.target.value)))}
          />
          {help}{problem}
        </div>
      );
    case "range": {
      const num = typeof current === "number" ? current : (d.min ?? 0);
      return (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            {labelEl}
            <span className="text-xs text-muted-foreground tabular-nums">{num}{d.unit ?? ""}</span>
          </div>
          <input
            id={id}
            type="range"
            min={d.min}
            max={d.max}
            step={d.step ?? 1}
            value={num}
            disabled={disabled}
            onChange={(e) => onChange(Number(e.target.value))}
            className="h-2 w-full cursor-pointer accent-primary disabled:cursor-not-allowed"
          />
          {help}{problem}
        </div>
      );
    }
    case "toggle":
      return (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-3">
            {labelEl}
            <Switch id={id} checked={Boolean(current)} disabled={disabled} onCheckedChange={(checked) => onChange(checked)} />
          </div>
          {help}{problem}
        </div>
      );
    case "select":
    case "radio":
    case "segmented":
      return (
        <div className="space-y-1.5">
          {labelEl}
          <NativeSelect
            id={id}
            value={String(current ?? "")}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            onChange={(e) => {
              const option = d.options?.find((o) => String(o.value) === e.target.value);
              onChange(option ? option.value : e.target.value);
            }}
          >
            {(d.options ?? []).map((o) => (
              <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
            ))}
          </NativeSelect>
          {help}{problem}
        </div>
      );
    case "color":
      return <ColorField id={id} descriptor={d} value={typeof current === "string" ? current : ""} disabled={disabled} error={error} onChange={onChange} />;
    case "image":
      return <ImageField descriptor={d} value={value} disabled={disabled} error={error} onChange={onChange} />;
    default:
      return (
        <div className="space-y-1">
          {labelEl}
          <p className="text-xs text-muted-foreground">This setting is edited in code and is kept as it is.</p>
        </div>
      );
  }
}

function unwrapResponsive(value: unknown): unknown {
  if (value && typeof value === "object" && "base" in value) return (value as { base: unknown }).base;
  return value;
}

function ColorField({ id, descriptor: d, value, disabled, error, onChange }: { id: string; descriptor: SettingDescriptor; value: string; disabled?: boolean; error?: string; onChange: (v: unknown) => void }) {
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? value;
  const valid = HEX.test(shown);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium">{d.label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${d.label} picker`}
          value={HEX.test(value) ? value : "#000000"}
          disabled={disabled}
          onChange={(e) => { setText(null); onChange(e.target.value.toLowerCase()); }}
          className="size-8 shrink-0 cursor-pointer rounded-md border bg-transparent p-0.5 disabled:cursor-not-allowed"
        />
        <Input
          id={id}
          value={shown}
          disabled={disabled}
          maxLength={7}
          spellCheck={false}
          aria-invalid={Boolean(error) || (shown !== "" && !valid)}
          className="font-mono text-xs uppercase"
          onChange={(e) => {
            const next = e.target.value.startsWith("#") || e.target.value === "" ? e.target.value : `#${e.target.value}`;
            setText(next);
            if (HEX.test(next)) { onChange(next.toLowerCase()); setText(null); }
          }}
          onBlur={() => setText(null)}
        />
      </div>
      {shown !== "" && !valid ? <p className="text-xs text-muted-foreground">Use a 6-digit colour such as #1a5aaa.</p> : null}
      {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

/** Uploads into the store's own image folder; the stored value is `{ path, alt }`, or a theme picture `{ asset }` that can be replaced. */
function ImageField({ descriptor: d, value, disabled, error, onChange }: { descriptor: SettingDescriptor; value: unknown; disabled?: boolean; error?: string; onChange: (v: unknown) => void }) {
  const stored = value && typeof value === "object" ? (value as { path?: string; asset?: string; alt?: string }) : null;
  const [items, setItems] = useState<ImageItem[]>(() =>
    stored?.path ? [{ key: stored.path, path: stored.path, altText: stored.alt ?? null, progress: 100, status: "done", saved: true }] : [],
  );
  const usingThemePicture = Boolean(stored?.asset) && items.length === 0;

  // The latest list, so the next one can be worked out here and `onChange` (which updates the editor) is never called
  // from inside a state updater, where React forbids updating another component.
  const itemsRef = useRef(items);
  const update = (next: ImageItem[] | ((prev: ImageItem[]) => ImageItem[])) => {
    const list = typeof next === "function" ? next(itemsRef.current) : next;
    itemsRef.current = list;
    setItems(list);
    const done = list.find((i) => i.status === "done" && i.path);
    // Only a finished upload is written to the document; removing the picture clears the setting.
    if (done?.path) onChange({ path: done.path, ...(stored?.alt ? { alt: stored.alt } : {}) });
    else if (list.length === 0) onChange(undefined);
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{d.label}</Label>
      {usingThemePicture ? <p className="text-xs text-muted-foreground">Using the theme&apos;s picture. Upload yours to replace it.</p> : null}
      <div className={cn(disabled && "pointer-events-none opacity-60")}>
        <ImageUploader value={items} onChange={update} scope="store" max={1} single disabled={disabled} label={d.label} />
      </div>
      {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
