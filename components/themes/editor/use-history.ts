"use client";

import { useState, useSyncExternalStore } from "react";
import { emptyHistory, type History } from "@/lib/themes/editor/history";

/** The undo history, kept outside React state so recording a step from an effect does not cascade renders. */
class HistoryStore {
  private value: History = emptyHistory();
  private readonly listeners = new Set<() => void>();

  readonly get = (): History => this.value;

  readonly set = (next: History): void => {
    this.value = next;
    this.listeners.forEach((listener) => listener());
  };

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
}

/** The editor's undo history; the Undo and Redo buttons re-render when it changes. */
export function useHistoryStore() {
  const [store] = useState(() => new HistoryStore());
  const history = useSyncExternalStore(store.subscribe, store.get, store.get);
  return { history, get: store.get, set: store.set };
}
