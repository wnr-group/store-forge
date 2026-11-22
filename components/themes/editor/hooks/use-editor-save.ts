"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { saveDraftAction, savePresentationDraftAction } from "@/app/(dashboard)/dashboard/templates/actions";
import { validateDocument } from "@/lib/templates/engine/validate";
import { getRegistry } from "@/lib/templates/registry/index";
import { studioComponentProblems } from "@/lib/templates/component-checks";
import { presentationKey, validatePresentation } from "@/lib/templates/product-presentation";
import { createFlusher, type FlushResult } from "@/lib/themes/editor/flusher";
import { dirtyEntries, markEntrySaved, problemsFromFieldErrors, type PresentationStore } from "@/lib/themes/editor/presentation-state";
import { autosaveDelay, deriveSaveStatus, mapDraftFieldErrors, type SaveState, type SaveStatus } from "@/lib/themes/editor/shell-logic";
import { prepareDocumentForSave } from "@/lib/themes/editor/display-state";
import { dirtyDocs, markSaved, type EditorState } from "@/lib/themes/editor/state";
import { foldVirtualPages, isVirtualId } from "@/lib/themes/editor/virtual";
import { refreshTemplateStates } from "@/lib/themes/refresh";

const registry = getRegistry();

type Args = {
  tenantId: string;
  state: EditorState;
  stateRef: MutableRefObject<EditorState>;
  commit: (fn: (s: EditorState) => EditorState) => EditorState;
  presStore: PresentationStore;
  presRef: MutableRefObject<PresentationStore>;
  setPresStore: Dispatch<SetStateAction<PresentationStore>>;
  setPresServerProblems: Dispatch<SetStateAction<Record<string, Record<string, string>>>>;
  setPresConflict: Dispatch<SetStateAction<string | null>>;
  saveState: SaveState;
  setSaveState: Dispatch<SetStateAction<SaveState>>;
};

/** Saving: local validation, the save run (pages, then product settings), autosave with retries, the leave warning, and the visible save status. */
export function useEditorSave({ tenantId, state, stateRef, commit, presStore, presRef, setPresStore, setPresServerProblems, setPresConflict, saveState, setSaveState }: Args) {
  const queryClient = useQueryClient();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [serverProblems, setServerProblems] = useState<Record<string, Record<string, string>>>({});
  const saving = useRef(false);
  const retries = useRef(0);

  // ---- local validation: the engine's own rules, before anything is sent ---------------------------------------
  const localProblems = useMemo(() => {
    const out: Record<string, Record<string, string>> = {};
    for (const d of dirtyDocs(state)) {
      const result = validateDocument(d.kind, d.document, registry, { tenantId });
      const found: Record<string, string> = {};
      if (!result.ok) {
        for (const i of result.issues) if (i.level === "error") found[i.path] = i.message;
      }
      // Wording and link rules of the countdown and trust badge settings (not part of the engine's schema).
      Object.assign(found, studioComponentProblems(d.document));
      if (Object.keys(found).length) out[d.templateId] = found;
    }
    return out;
  }, [state, tenantId]);
  const presLocalProblems = useMemo(() => {
    const out: Record<string, Record<string, string>> = {};
    for (const e of dirtyEntries(presStore)) {
      const found = validatePresentation(e.document);
      if (Object.keys(found).length) out[e.productId] = found;
    }
    return out;
  }, [presStore]);
  const hasLocalProblems = Object.keys(localProblems).length > 0 || Object.keys(presLocalProblems).length > 0;
  const problems = useMemo(() => {
    const merged: Record<string, Record<string, string>> = { ...serverProblems };
    for (const [id, p] of Object.entries(localProblems)) merged[id] = { ...merged[id], ...p };
    return merged;
  }, [serverProblems, localProblems]);

  const dirtyCount = dirtyDocs(state).length + dirtyEntries(presStore).length;
  const status: SaveStatus = deriveSaveStatus(saveState, hasLocalProblems, dirtyCount);

  // ---- saving --------------------------------------------------------------------------------------------------
  // One save run. It is started through `flusher`, which allows only one at a time and lets Publish wait for it.
  const runFlush = useCallback(async (): Promise<FlushResult> => {
    saving.current = true;
    // True once any page draft was saved in this run: the list of publication states is read again once, however this run ends.
    let savedPage = false;
    setSaveState("saving");
    setSaveError(null);
    try {
      // Generated pages (all products, cart ...) live inside the theme document: fold their changes into it first.
      const themeId = Object.values(stateRef.current.docs).find((d) => d.kind === "theme_settings")?.templateId;
      if (themeId) commit((s) => foldVirtualPages(s, themeId));
      for (const doc of dirtyDocs(stateRef.current).filter((d) => !isVirtualId(d.templateId))) {
        const json = JSON.stringify(doc.document);
        // A document with a display rule is saved at schema 2 (the existing migration); one without stays as it is.
        const result = await saveDraftAction({ id: doc.templateId, document: prepareDocumentForSave(doc.document), expectedRevision: doc.revision });
        if (!result.ok) {
          if (result.code === "CONFLICT") {
            setPresConflict(null);
            setSaveState("conflict");
            return { ok: false, reason: "conflict" };
          }
          if (result.fieldErrors) {
            const mapped = mapDraftFieldErrors(doc.kind, result.fieldErrors);
            setServerProblems((prev) => ({ ...prev, [doc.templateId]: mapped }));
          }
          setSaveState("error");
          setSaveError(result.error);
          return { ok: false, reason: result.fieldErrors ? "validation" : "error", message: result.error };
        }
        const saved = result.data!;
        setServerProblems((prev) => ({ ...prev, [doc.templateId]: {} }));
        commit((prev) => markSaved(prev, doc.templateId, saved.revision, saved.document, json));
        savedPage = true;
      }
      // Product settings are saved after the pages, each with its own revision. A 409 here concerns that product only.
      for (const entry of dirtyEntries(presRef.current)) {
        const key = presentationKey(entry.document);
        const result = await savePresentationDraftAction({ productId: entry.productId, document: entry.document, expectedRevision: entry.revision });
        if (!result.ok) {
          if (result.code === "CONFLICT") {
            setPresConflict(entry.productId);
            setSaveState("conflict");
            return { ok: false, reason: "conflict" };
          }
          if (result.fieldErrors) {
            const mapped = problemsFromFieldErrors(entry.productId, result.fieldErrors);
            setPresServerProblems((prev) => ({ ...prev, [entry.productId]: mapped }));
          }
          setSaveState("error");
          setSaveError(result.error);
          return { ok: false, reason: result.fieldErrors ? "validation" : "error", message: result.error };
        }
        const savedEntry = result.data!;
        setPresServerProblems((prev) => ({ ...prev, [entry.productId]: {} }));
        setPresStore((prev) => markEntrySaved(prev, savedEntry, key));
      }
      retries.current = 0;
      setSaveState("idle");
      return { ok: true };
    } catch {
      setSaveState("error");
      setSaveError("Your changes could not be saved. Check your connection.");
      return { ok: false, reason: "error", message: "Your changes could not be saved. Check your connection." };
    } finally {
      saving.current = false;
      // Saving moved the pages' publication state on the server (published -> published with changes). Product settings do not,
      // so they never trigger this. Not awaited: it must not delay the end of the save.
      if (savedPage) void refreshTemplateStates(queryClient);
    }
  }, [commit, queryClient, stateRef, presRef, setPresConflict, setPresServerProblems, setPresStore, setSaveState]);

  // Created once; it always runs the latest save run.
  const [flusher] = useState(() => createFlusher());
  useEffect(() => {
    flusher.setRun(runFlush);
  }, [flusher, runFlush]);
  /** Autosave and leaving: starts a save, or says false while one is already running (unchanged). Publishing waits instead: see flusher.settle. */
  const flush = useCallback(async (): Promise<boolean> => {
    if (flusher.isRunning()) return false;
    return (await flusher.flush()).ok;
  }, [flusher]);
  /** Everything (pages, shared parts, product settings) is saved. */
  const allSaved = () => dirtyDocs(stateRef.current).length === 0 && dirtyEntries(presRef.current).length === 0;
  /** Product settings are saved. */
  const productsSaved = () => dirtyEntries(presRef.current).length === 0;

  useEffect(() => {
    // Debounced autosave. A failed save retries a few times with a growing pause, then waits for the merchant.
    const delay = autosaveDelay(status, retries.current);
    if (delay === null) return;
    const timer = setTimeout(() => {
      if (status === "error") retries.current += 1;
      void flush();
    }, delay);
    return () => clearTimeout(timer);
  }, [state, presStore, status, flush]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirtyDocs(stateRef.current).length > 0 || dirtyEntries(presRef.current).length > 0 || saving.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [stateRef, presRef]);

  /** "Try again" on the save error: forgets the failed attempts and saves now. */
  const retrySave = () => {
    retries.current = 0;
    void flush();
  };

  return { saveError, setServerProblems, retrySave, flusher, flush, allSaved, productsSaved, problems, presLocalProblems, hasLocalProblems, dirtyCount, status };
}
