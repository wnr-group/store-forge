"use client";

import { useCallback, useMemo, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { toast } from "sonner";
import type { SectionActions } from "../sections-panel";
import { adapterForLook, lookOf } from "@/lib/editor/adapters";
import { applyInlineEdit, locateInlineEdit } from "@/lib/editor/inline";
import { findSettingForClick } from "@/lib/editor/locate";
import { originalOf, readTextOverrides } from "@/lib/editor/text";
import type { PartStyleKey, StyleDevice, StyleKey as StyleKeyType } from "@/lib/editor/style";
import { cardKindOf, descriptionOnByDefault } from "@/lib/templates/card-parts";
import type { ComponentNode } from "@/lib/templates/document";
import { isHomeTheme } from "@/lib/templates/engine/theme-style";
import { getRegistry } from "@/lib/templates/registry/index";
import { findNode, lookupOrder, type SaveState } from "@/lib/themes/editor/shell-logic";
import {
  addBlock, addSection, createBlockNode, duplicateSection, moveBlock, moveSection, removeBlock, removeSection, resetElementStyle, select, setElementStyle, setSetting,
  setTextOverride, setTextStyle, toggleSection, type EditorState,
} from "@/lib/themes/editor/state";
import type { ClickTarget } from "../../theme-frame";

const registry = getRegistry();

type Args = {
  state: EditorState;
  stateRef: MutableRefObject<EditorState>;
  commit: (fn: (s: EditorState) => EditorState) => EditorState;
  setSaveState: Dispatch<SetStateAction<SaveState>>;
  setLeftTab: Dispatch<SetStateAction<"sections" | "theme" | "product">>;
  setMobileTab: Dispatch<SetStateAction<"sections" | "preview" | "settings">>;
};

/** Everything that changes the drafts from the panels and the preview: section actions, clicks and inline text on the page, style and text overrides. */
export function useEditorEdits({ state, stateRef, commit, setSaveState, setLeftTab, setMobileTab }: Args) {
  const [focusSetting, setFocusSetting] = useState<{ key: string; nonce: number } | null>(null);
  const [clickedText, setClickedText] = useState<{ text: string; nonce: number } | null>(null);
  // The product card picked on the page (its section and its position among that section's cards). Not part of the saved design.
  const [pickedCard, setPickedCard] = useState<{ sectionId: string; index: number; product?: string; collection?: string } | null>(null);

  /** Applies an edit. The undo history watches the committed drafts (see "undo and redo" below), so it records the step itself. */
  const edit = useCallback(
    // `_key` is kept so callers can still name a burst of edits; the history now joins bursts by time (COALESCE_MS).
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (fn: (s: EditorState) => EditorState, _key?: string) => {
      commit(fn);
      setSaveState((s) => (s === "error" ? "idle" : s));
    },
    [commit, setSaveState],
  );

  const actions: SectionActions = useMemo(
    () => ({
      select: (docId, sectionId, blockId) => { edit((s) => select(s, { docId, sectionId, blockId })); setPickedCard(null); setLeftTab("sections"); setMobileTab("settings"); },
      toggle: (docId, sectionId) => edit((s) => toggleSection(s, docId, sectionId)),
      duplicate: (docId, sectionId) => edit((s) => duplicateSection(s, docId, sectionId)),
      remove: (docId, sectionId) => edit((s) => removeSection(s, docId, sectionId)),
      move: (docId, sectionId, toIndex) => edit((s) => moveSection(s, docId, sectionId, toIndex, registry)),
      add: (docId, type, index) => {
        const def = registry.sections[type];
        if (def) edit((s) => addSection(s, docId, def, registry, index).state);
        setMobileTab("settings");
      },
      addBlock: (docId, sectionId, type) => {
        const block = createBlockNode(type, registry);
        if (block) edit((s) => addBlock(s, docId, sectionId, block).state);
      },
      removeBlock: (docId, sectionId, blockId) => edit((s) => removeBlock(s, docId, sectionId, blockId)),
      moveBlock: (docId, sectionId, blockId, toIndex) => edit((s) => moveBlock(s, docId, sectionId, blockId, toIndex, registry)),
      setSetting: (docId, sectionId, key, value) => edit((s) => setSetting(s, docId, sectionId, undefined, key, value), `set:${docId}:${sectionId}::${key}`),
    }),
    [edit, setLeftTab, setMobileTab],
  );

  /** What the theme lets the merchant style, and the look it comes from. */
  const adapter = useMemo(() => {
    const themeId = Object.values(state.docs).find((d) => d.kind === "theme_settings")?.templateId;
    return adapterForLook(lookOf(themeId ? state.docs[themeId].document : null));
    // Only the theme document decides this; page edits never change the look.
  }, [state.docs]);

  /** What the theme means for product cards: which elements the cards of its look can show, and what they do without a choice. */
  const cardContext = useMemo(() => {
    const themeId = Object.values(state.docs).find((d) => d.kind === "theme_settings")?.templateId;
    const themeDoc = themeId ? state.docs[themeId].document : null;
    const look = lookOf(themeDoc);
    return { look, descriptionDefault: descriptionOnByDefault(look, isHomeTheme(themeDoc)) };
  }, [state.docs]);

  const onPreviewSelect = useCallback(
    (target: ClickTarget) => {
      const s = stateRef.current;
      const order = lookupOrder(s);
      const docId = order.find((id) => (s.docs[id].document as { sections?: Record<string, unknown> }).sections?.[target.sectionId]);
      if (!docId) return;
      const known = (s.docs[docId].document as { sections: Record<string, ComponentNode> }).sections[target.sectionId];
      const blockId = target.blockId && known && findNode(known, target.blockId) ? target.blockId : undefined;
      edit((prev) => select(prev, { docId, sectionId: target.sectionId, blockId }));
      setPickedCard(target.card !== undefined && !blockId && cardKindOf(known?.type) ? { sectionId: target.sectionId, index: target.card, product: target.product, collection: target.collection } : null);
      setLeftTab("sections");
      setMobileTab("settings");
      // Clicked text or a picture: jump to the setting that holds it (the block first, then its section).
      const section = (s.docs[docId].document as { sections: Record<string, ComponentNode> }).sections[target.sectionId];
      const block = blockId ? findNode(section, blockId) : undefined;
      const element = block ?? section;
      const descriptors = (block ? registry.blocks[block.type] : registry.sections[section.type])?.settings ?? [];
      const key = findSettingForClick([{ descriptors, settings: element.settings }], target);
      setFocusSetting(key ? { key, nonce: Date.now() } : null);
      // A product card's name and price come from the product, not from a setting: nothing to replace here.
      if (target.card !== undefined && cardKindOf(known?.type)) return void setClickedText(null);
      // Text no setting holds (the theme writes it into its own components): offer it for replacement in the panel.
      const shown = target.text ? originalOf(readTextOverrides(section.settings), target.text) : "";
      setClickedText(!key && target.text ? { text: shown, nonce: Date.now() } : null);
    },
    [edit, stateRef, setLeftTab, setMobileTab],
  );

  /** Text edited directly on the page: saved where the text lives (see lib/editor/inline.ts). */
  const onEditText = useCallback(
    (e: { sectionId: string; blockId?: string; original: string; value: string }) => {
      const s = stateRef.current;
      const docId = lookupOrder(s).find((id) => (s.docs[id].document as { sections?: Record<string, unknown> }).sections?.[e.sectionId]);
      if (!docId) return;
      const section = (s.docs[docId].document as { sections: Record<string, ComponentNode> }).sections[e.sectionId];
      const blockId = e.blockId && findNode(section, e.blockId) ? e.blockId : undefined;
      const target = locateInlineEdit(section, blockId, registry, e.original);
      edit((st) => applyInlineEdit(st, docId, e.sectionId, target, e.value), `inline:${docId}:${e.sectionId}:${blockId ?? ""}:${target.from}`);
    },
    [edit, stateRef],
  );
  const onEditBlocked = useCallback(() => toast.message("This text is made of several parts. Select it and change it in the sidebar."), []);

  /** The name on a selected or hovered element's tag: the block's name, else the section's. */
  const labelFor = useCallback((pick: { sectionId: string; blockId?: string }) => {
    const s = stateRef.current;
    for (const id of lookupOrder(s)) {
      const section = (s.docs[id].document as { sections?: Record<string, ComponentNode> }).sections?.[pick.sectionId];
      if (!section) continue;
      const block = pick.blockId ? findNode(section, pick.blockId) : undefined;
      return block ? (registry.blocks[block.type]?.name ?? block.type) : (registry.sections[section.type]?.name ?? section.type);
    }
    return "";
  }, [stateRef]);

  const onStyle = useCallback(
    (docId: string, sectionId: string, blockId: string | undefined, device: StyleDevice, key: StyleKeyType, value: unknown) =>
      edit((s) => setElementStyle(s, docId, sectionId, blockId, device, key, value), `style:${docId}:${sectionId}:${blockId ?? ""}:${device}:${key}`),
    [edit],
  );
  const onResetStyle = useCallback((docId: string, sectionId: string, blockId: string | undefined) => edit((s) => resetElementStyle(s, docId, sectionId, blockId)), [edit]);
  const onText = useCallback(
    (docId: string, sectionId: string, from: string, to: string | undefined) => edit((s) => setTextOverride(s, docId, sectionId, from, to), `text:${docId}:${sectionId}:${from}`),
    [edit],
  );
  const onTextStyle = useCallback(
    (docId: string, sectionId: string, from: string, key: PartStyleKey, value: unknown) => edit((s) => setTextStyle(s, docId, sectionId, from, key, value), `textstyle:${docId}:${sectionId}:${from}:${key}`),
    [edit],
  );
  const clearFocus = useCallback(() => setFocusSetting(null), []);
  const onSelectParent = useCallback((docId: string, sectionId: string) => edit((s) => select(s, { docId, sectionId })), [edit]);
  return { edit, actions, adapter, cardContext, pickedCard, setPickedCard, focusSetting, clickedText, onPreviewSelect, onEditText, onEditBlocked, labelFor, onStyle, onResetStyle, onText, onTextStyle, clearFocus, onSelectParent };
}
