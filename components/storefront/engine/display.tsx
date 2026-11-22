import React from "react";
import type { ComponentNode } from "@/lib/templates/document";
import { deviceCss, parseDisplayRules } from "@/lib/templates/display-rules";
import { isNodeActive, serverClock } from "@/lib/templates/display-prune";
import type { RenderContext } from "./types";

/**
 * The instant schedules are judged at. Public: the server clock (`serverNow`, set by the server component), else this process's
 * clock; a public request can never choose it. Preview and editor: only an explicit `previewNow`, otherwise null, which shows
 * every node so the merchant can always see and edit it.
 */
export function scheduleNow(context: RenderContext): number | null {
  if (context.mode === "public" || context.mode === undefined) return typeof context.serverNow === "number" ? context.serverNow : serverClock();
  if (context.previewNow === undefined) return null;
  const t = typeof context.previewNow === "number" ? context.previewNow : Date.parse(context.previewNow);
  return Number.isFinite(t) ? t : null;
}

/** False when the node's schedule is not active, so the caller renders nothing for it (omitted, never sent and hidden). */
export function passesSchedule(node: ComponentNode, context: RenderContext): boolean {
  if (node.display === undefined) return true;
  const now = scheduleNow(context);
  return now === null ? true : isNodeActive(node, now);
}

/** Wraps a node that hides on some devices in a box-less element carrying fixed classes; any other node comes back unchanged. */
export function withDeviceRule(node: ComponentNode, out: React.ReactNode, key?: string): React.ReactNode {
  if (node.display === undefined) return out;
  const css = deviceCss(parseDisplayRules(node.display));
  if (!css) return out;
  return (
    <div key={key} className={css.className} data-sf-hide={css.hide}>
      {out}
    </div>
  );
}
