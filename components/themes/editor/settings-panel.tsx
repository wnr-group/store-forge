"use client";

import { CornerLeftUp, MousePointerClick } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ThemeEditorAdapter } from "@/lib/editor/adapter";
import { readStyle, type PartStyleKey, type StyleDevice, type StyleKey } from "@/lib/editor/style";
import { isSettingVisible } from "@/lib/templates/engine/descriptor-check";
import type { ComponentNode } from "@/lib/templates/document";
import type { SettingDescriptor } from "@/lib/templates/engine/descriptors";
import { getRegistry } from "@/lib/templates/registry/index";
import { themeSettingDescriptors } from "@/lib/templates/registry/theme-settings";
import type { EditorState } from "@/lib/themes/editor/state";
import { SettingField } from "./setting-field";
import { StylePanel } from "./style-panel";
import { TextOnPage } from "./text-on-page";

const registry = getRegistry();

const GROUP_LABELS: Record<string, string> = {
  brand: "Brand",
  colors: "Colours",
  typography: "Typography",
  layout: "Layout",
  buttons: "Buttons and corners",
  social: "Social media links",
};

type Props = {
  state: EditorState;
  disabled: boolean;
  /** Validation problems by document path, e.g. `sections.hero.settings.heading`. */
  problems: Record<string, Record<string, string>>;
  onSetting: (docId: string, sectionId: string, blockId: string | undefined, key: string, value: unknown) => void;
  onThemeSetting: (docId: string, group: string, key: string, value: unknown) => void;
  themeDocId: string | null;
  mode: "section" | "theme";
  /** What the active theme lets merchants style (see lib/editor/adapter.ts). */
  adapter: ThemeEditorAdapter;
  /** The device being previewed, so style changes are written for it. */
  styleDevice: StyleDevice;
  onStyle: (docId: string, sectionId: string, blockId: string | undefined, device: StyleDevice, key: StyleKey, value: unknown) => void;
  onResetStyle: (docId: string, sectionId: string, blockId: string | undefined) => void;
  onSelectParent: (docId: string, sectionId: string) => void;
  /** A setting to jump to (set when text or a picture is clicked in the preview). `nonce` makes a repeat click count. */
  focusSetting: { key: string; nonce: number } | null;
  /** Called once the jump has been made, so a later selection does not repeat it. */
  onFocusConsumed: () => void;
  /** Text clicked in the preview that no setting holds, and the handler that replaces it. */
  clickedText: { text: string; nonce: number } | null;
  onText: (docId: string, sectionId: string, from: string, to: string | undefined) => void;
  onTextStyle: (docId: string, sectionId: string, from: string, key: PartStyleKey, value: unknown) => void;
};

export function SettingsPanel({ state, disabled, problems, onSetting, onThemeSetting, themeDocId, mode, adapter, styleDevice, onStyle, onResetStyle, onSelectParent, focusSetting, onFocusConsumed, clickedText, onText, onTextStyle }: Props) {
  if (mode === "theme") {
    return themeDocId && state.docs[themeDocId] ? (
      <ThemeSettings doc={state.docs[themeDocId].document} disabled={disabled} problems={problems[themeDocId] ?? {}} onChange={(group, key, value) => onThemeSetting(themeDocId, group, key, value)} />
    ) : (
      <Empty title="No theme settings" text="This store has no theme settings document yet. Apply a theme to create one." />
    );
  }

  const sel = state.selection;
  if (!sel || !("sectionId" in sel)) {
    return <Empty title="Select an element" text="Click anything in the preview, or pick a section from the list, to edit its content and style." />;
  }
  const doc = state.docs[sel.docId]?.document as { sections?: Record<string, ComponentNode> } | undefined;
  const section = doc?.sections?.[sel.sectionId];
  if (!section) return <Empty title="Select an element" text="That section is no longer on the page." />;
  const node = sel.blockId ? findBlock(section, sel.blockId) : section;
  if (!node) return <Empty title="Select an element" text="That block is no longer on the page." />;
  return (
    <ElementEditor
      key={`${sel.docId}:${sel.sectionId}:${sel.blockId ?? ""}`}
      docId={sel.docId}
      sectionId={sel.sectionId}
      blockId={sel.blockId}
      section={section}
      node={node}
      disabled={disabled}
      problems={problems[sel.docId] ?? {}}
      onSetting={onSetting}
      adapter={adapter}
      styleDevice={styleDevice}
      onStyle={onStyle}
      onResetStyle={onResetStyle}
      onSelectParent={onSelectParent}
      focusSetting={focusSetting}
      onFocusConsumed={onFocusConsumed}
      clickedText={clickedText}
      onText={onText}
      onTextStyle={onTextStyle}
    />
  );
}

type ElementEditorProps = Pick<Props, "disabled" | "onSetting" | "adapter" | "styleDevice" | "onStyle" | "onResetStyle" | "onSelectParent" | "focusSetting" | "onFocusConsumed" | "clickedText" | "onText" | "onTextStyle"> & {
  docId: string;
  sectionId: string;
  blockId: string | undefined;
  section: ComponentNode;
  node: ComponentNode;
  problems: Record<string, string>;
};

/** The selected section or block: a Content tab (its own settings) and a Style tab (what the theme's adapter allows). */
function ElementEditor({ docId, sectionId, blockId, section, node, disabled, problems, onSetting, adapter, styleDevice, onStyle, onResetStyle, onSelectParent, focusSetting, onFocusConsumed, clickedText, onText, onTextStyle }: ElementEditorProps) {
  const [tab, setTab] = useState<"content" | "style">("content");
  const content = useRef<HTMLDivElement>(null);
  const def = blockId ? registry.blocks[node.type] : registry.sections[node.type];
  const base = blockId ? `sections.${sectionId}.blocks.${blockId}.settings` : `sections.${sectionId}.settings`;
  const spec = blockId ? adapter.block(node.type, section.type) : adapter.section(node.type);

  // Clicking text or a picture in the preview jumps to the content setting that holds it. The Content tab is shown while rendering
  // (not from an effect); the effect then moves focus to the field once, and clears the request.
  const [seen, setSeen] = useState<number | null>(null);
  if (focusSetting && focusSetting.nonce !== seen) {
    setSeen(focusSetting.nonce);
    if (tab !== "content") setTab("content");
  }
  useEffect(() => {
    if (!focusSetting) return;
    const frame = requestAnimationFrame(() => {
      const target = content.current?.querySelector<HTMLElement>(`[data-setting-id="${CSS.escape(focusSetting.key)}"]`);
      target?.scrollIntoView({ block: "center", behavior: "smooth" });
      target?.querySelector<HTMLElement>("input, textarea, select, button")?.focus({ preventScroll: true });
      onFocusConsumed();
    });
    return () => cancelAnimationFrame(frame);
  }, [focusSetting, onFocusConsumed]);

  const parentName = registry.sections[section.type]?.name ?? section.type;
  return (
    <div className="space-y-4 p-4">
      <header className="space-y-1">
        {blockId ? (
          <Button type="button" variant="ghost" size="xs" className="-ml-2" onClick={() => onSelectParent(docId, sectionId)}>
            <CornerLeftUp aria-hidden /> Select {parentName}
          </Button>
        ) : null}
        <h2 className="text-sm font-semibold">{def?.name ?? node.type}</h2>
        <p className="text-xs text-muted-foreground">
          {blockId ? `Block in ${parentName}` : "Section"}
          {def?.description ? `. ${def.description}` : ""}
        </p>
      </header>

      <div className="flex gap-1 rounded-md border p-0.5" role="tablist" aria-label={`${def?.name ?? node.type} settings`}>
        {(["content", "style"] as const).map((t) => (
          <Button key={t} type="button" size="sm" variant={tab === t ? "secondary" : "ghost"} className="flex-1 capitalize" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
            {t}
          </Button>
        ))}
      </div>

      {tab === "content" ? (
        <div ref={content} role="tabpanel" aria-label="Content" className="space-y-4">
          <TextOnPage section={section} clicked={clickedText} disabled={disabled} onChange={(from, to) => onText(docId, sectionId, from, to)} onStyle={(from, key, value) => onTextStyle(docId, sectionId, from, key, value)} />
          {def && def.settings.length > 0 ? (
            <div className="space-y-4">
              {def.settings
                .filter((d) => isSettingVisible(d, node.settings))
                .map((d) => (
                  <div key={`${docId}:${sectionId}:${blockId ?? ""}:${d.id}`} data-setting-id={d.id} className="rounded-md">
                    <SettingField descriptor={d} value={node.settings?.[d.id]} disabled={disabled} error={problems[`${base}.${d.id}`]} onChange={(value) => onSetting(docId, sectionId, blockId, d.id, value)} />
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">This {blockId ? "block" : "section"} has no content settings of its own. {def?.accepts?.length ? "Add blocks to it from the list on the left." : ""}</p>
          )}
        </div>
      ) : (
        <div role="tabpanel" aria-label="Style">
          {spec ? (
            <StylePanel
              spec={spec}
              style={readStyle(node.settings)}
              device={styleDevice}
              disabled={disabled}
              onChange={(key, value) => onStyle(docId, sectionId, blockId, styleDevice, key, value)}
              onResetAll={() => onResetStyle(docId, sectionId, blockId)}
            />
          ) : (
            <p className="rounded-md bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
              {blockId
                ? `${adapter.name} draws this block as part of its section, so it has no style controls of its own. Change its content here, or style the whole section.`
                : `${adapter.name} keeps this section as it is. Its colours and fonts come from Theme settings.`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function findBlock(node: ComponentNode, blockId: string): ComponentNode | undefined {
  if (node.blocks[blockId]) return node.blocks[blockId];
  for (const child of Object.values(node.blocks)) {
    const found = findBlock(child, blockId);
    if (found) return found;
  }
  return undefined;
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
      <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground"><MousePointerClick className="size-5" aria-hidden /></span>
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="max-w-56 text-xs text-muted-foreground">{text}</p>
    </div>
  );
}

function ThemeSettings({ doc, disabled, problems, onChange }: { doc: Record<string, unknown>; disabled: boolean; problems: Record<string, string>; onChange: (group: string, key: string, value: unknown) => void }) {
  const settings = (doc.settings ?? {}) as Record<string, Record<string, unknown>>;
  const groups = useMemo(() => {
    const out = new Map<string, SettingDescriptor[]>();
    for (const d of themeSettingDescriptors) out.set(d.group ?? "other", [...(out.get(d.group ?? "other") ?? []), d]);
    return [...out.entries()];
  }, []);
  return (
    <div className="space-y-6 p-4">
      <header>
        <h2 className="text-sm font-semibold">Theme settings</h2>
        <p className="text-xs text-muted-foreground">These apply to every page of your store and update the preview immediately. Elements inherit them until you change them under Style.</p>
      </header>
      {groups.map(([group, descriptors]) => (
        <fieldset key={group} className="space-y-4">
          <legend className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{GROUP_LABELS[group] ?? group}</legend>
          {descriptors.map((d) => (
            <SettingField key={`${group}.${d.id}`} descriptor={d} value={settings[group]?.[d.id]} disabled={disabled} error={problems[`settings.${group}.${d.id}`]} onChange={(value) => onChange(group, d.id, value)} />
          ))}
        </fieldset>
      ))}
    </div>
  );
}
