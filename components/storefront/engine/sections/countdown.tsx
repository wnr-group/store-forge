import React from "react";
import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext } from "../types";
import { t } from "@/lib/i18n/messages";
import { readCountdownSettings, resolveCountdown } from "@/lib/templates/countdown";
import { serverClock } from "@/lib/templates/display-prune";
import { scheduleNow } from "../display";
import { CONTAINER } from "../ui";
import { cn } from "@/lib/utils";
import { CountdownClock } from "./countdown-clock";
import { CountdownEndMessage } from "./countdown-parts";

/** The instant the countdown is judged at: the server clock (`RenderContext.serverNow`), never the visitor clock. */
export function countdownNow(context: RenderContext): number {
  return scheduleNow(context) ?? serverClock();
}

/** A fixed-moment countdown. The server decides from its own clock; the client component only keeps the display ticking. */
export function CountdownSection({ node, context, sectionId }: { node: ComponentNode; context: RenderContext; sectionId?: string }) {
  const settings = readCountdownSettings(node.settings);
  const view = resolveCountdown(node, countdownNow(context));
  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};

  if (view.kind === "ended") return <CountdownEndMessage message={view.message} sectionId={sectionId} preview={isPreview} />;
  if (view.kind === "unset" || view.kind === "hidden") {
    // Visitors see nothing; the editor shows why the section is empty so it can still be selected.
    if (!isPreview) return null;
    return (
      <section className="w-full" {...sfProps}>
        <div className={cn(CONTAINER, "py-4")}>
          <p className="rounded-md border border-dashed p-3 text-center text-sm text-muted-foreground">{view.kind === "unset" ? t("countdown.editor.noTarget") : t("countdown.announce.ended")}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full bg-[var(--surface,var(--muted))]" {...sfProps}>
      <div className={cn(CONTAINER, "py-8 sm:py-10 lg:py-12")}>
        <CountdownClock target={view.target} serverNow={view.now} heading={settings.heading} endBehavior={settings.endBehavior} endMessage={settings.endMessage} />
      </div>
    </section>
  );
}
