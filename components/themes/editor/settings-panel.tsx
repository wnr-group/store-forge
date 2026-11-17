"use client";

import { MousePointerClick } from "lucide-react";
import { useMemo } from "react";
import { isSettingVisible } from "@/lib/templates/engine/descriptor-check";
import type { ComponentNode } from "@/lib/templates/document";
import type { SettingDescriptor } from "@/lib/templates/engine/descriptors";
import { getRegistry } from "@/lib/templates/registry/index";
import { themeSettingDescriptors } from "@/lib/templates/registry/theme-settings";
import type { EditorState } from "@/lib/themes/editor/state";
import { SettingField } from "./setting-field";

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
};

export function SettingsPanel({ state, disabled, problems, onSetting, onThemeSetting, themeDocId, mode }: Props) {
  if (mode === "theme") {
    return themeDocId && state.docs[themeDocId] ? (
      <ThemeSettings doc={state.docs[themeDocId].document} disabled={disabled} problems={problems[themeDocId] ?? {}} onChange={(group, key, value) => onThemeSetting(themeDocId, group, key, value)} />
    ) : (
      <Empty title="No theme settings" text="This store has no theme settings document yet. Apply a theme to create one." />
    );
  }

  const sel = state.selection;
  if (!sel || !("sectionId" in sel)) {
    return <Empty title="Select a section" text="Click a section in the preview or in the list to edit its content and style." />;
  }
  const doc = state.docs[sel.docId]?.document as { sections?: Record<string, ComponentNode> } | undefined;
  const section = doc?.sections?.[sel.sectionId];
  if (!section) return <Empty title="Select a section" text="That section is no longer on the page." />;
  const node = sel.blockId ? findBlock(section, sel.blockId) : section;
  if (!node) return <Empty title="Select a section" text="That block is no longer on the page." />;
  const def = sel.blockId ? registry.blocks[node.type] : registry.sections[node.type];
  const sectionProblems = problems[sel.docId] ?? {};
  const base = sel.blockId ? `sections.${sel.sectionId}.blocks.${sel.blockId}.settings` : `sections.${sel.sectionId}.settings`;

  return (
    <div className="space-y-4 p-4">
      <header>
        <h2 className="text-sm font-semibold">{def?.name ?? node.type}</h2>
        {def?.description ? <p className="text-xs text-muted-foreground">{def.description}</p> : null}
        {sel.blockId ? <p className="mt-1 text-xs text-muted-foreground">Block in {registry.sections[section.type]?.name ?? section.type}</p> : null}
      </header>
      {def && def.settings.length > 0 ? (
        <div className="space-y-4">
          {def.settings
            .filter((d) => isSettingVisible(d, node.settings))
            .map((d) => (
              <SettingField
                key={`${sel.docId}:${sel.sectionId}:${sel.blockId ?? ""}:${d.id}`}
                descriptor={d}
                value={node.settings?.[d.id]}
                disabled={disabled}
                error={sectionProblems[`${base}.${d.id}`]}
                onChange={(value) => onSetting(sel.docId, sel.sectionId, sel.blockId, d.id, value)}
              />
            ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">This {sel.blockId ? "block" : "section"} has no settings of its own. {def?.accepts?.length ? "Add blocks to it from the list on the left." : ""}</p>
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
        <p className="text-xs text-muted-foreground">These apply to every page of your store and update the preview immediately.</p>
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
