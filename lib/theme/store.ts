"use client";

import { useSyncExternalStore } from "react";
import { DARK_QUERY, THEME_KEY, type ResolvedTheme, type Theme } from "./script";

const EVENT = "sf-theme-change";

function read(): Theme {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export function resolve(theme: Theme): ResolvedTheme {
  return theme === "dark" || (theme === "system" && window.matchMedia(DARK_QUERY).matches) ? "dark" : "light";
}

function paint(theme: Theme) {
  const dark = resolve(theme) === "dark";
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
}

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(DARK_QUERY);
  const onSystem = () => {
    if (read() === "system") paint("system"); // follow the OS while in "system" mode
    onChange();
  };
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onSystem); // another tab changed it
  mq.addEventListener("change", onSystem);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onSystem);
    mq.removeEventListener("change", onSystem);
  };
}

/** The chosen theme ("system" until the user picks one). Server snapshot is "system". */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, read, () => "system");
}

/** The theme actually showing right now (system resolved to light/dark). */
export function useResolvedTheme(): ResolvedTheme {
  return useSyncExternalStore(
    (cb) => {
      const off = subscribe(cb);
      const mq = window.matchMedia(DARK_QUERY);
      mq.addEventListener("change", cb);
      return () => {
        off();
        mq.removeEventListener("change", cb);
      };
    },
    () => resolve(read()),
    () => "light",
  );
}

type Origin = { x: number; y: number };

function commit(theme: Theme) {
  try {
    if (theme === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* private mode / blocked storage: the choice just won't persist */
  }
  paint(theme);
  window.dispatchEvent(new Event(EVENT));
}

/**
 * Applies and persists a theme. With the View Transitions API the new theme grows as a circle
 * from `origin` (the toggle). Otherwise a short colour cross-fade runs. Reduced motion: instant.
 */
export function setTheme(theme: Theme, origin?: Origin) {
  const root = document.documentElement;
  if (resolve(theme) === resolve(read())) return commit(theme); // same look: nothing to animate
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return commit(theme);

  const start = (document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } }).startViewTransition?.bind(document);
  if (start && origin) {
    const radius = Math.hypot(Math.max(origin.x, innerWidth - origin.x), Math.max(origin.y, innerHeight - origin.y));
    const transition = start(() => commit(theme));
    transition.ready
      .then(() =>
        root.animate(
          { clipPath: [`circle(0px at ${origin.x}px ${origin.y}px)`, `circle(${radius}px at ${origin.x}px ${origin.y}px)`] },
          { duration: 600, easing: "cubic-bezier(0.4, 0, 0.2, 1)", pseudoElement: "::view-transition-new(root)" },
        ),
      )
      .catch(() => {});
    return;
  }

  root.classList.add("theme-fade");
  commit(theme);
  window.setTimeout(() => root.classList.remove("theme-fade"), 400);
}
