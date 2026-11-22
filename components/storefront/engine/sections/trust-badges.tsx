import React from "react";
import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext } from "../types";
import { t } from "@/lib/i18n/messages";
import { BADGE_DISCLAIMER_KEY } from "@/lib/templates/trust-badges";
import { renderBlockComponent } from "../blocks";
import { passesSchedule } from "../display";
import { CONTAINER } from "../ui";
import { cn } from "@/lib/utils";

/** A row of store-owner badges, always followed by the disclaimer that the claims are the owner's own and not verified by Store Forge. */
export function TrustBadgesSection({ node, context, sectionId }: { node: ComponentNode; context: RenderContext; sectionId?: string }) {
  const heading = typeof node.settings?.heading === "string" ? node.settings.heading : "";
  const left = node.settings?.alignment === "left";
  const blocks = node.blocks ?? {};
  const order = node.block_order ?? Object.keys(blocks);
  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};
  const shown = order.filter((id) => blocks[id] && !(blocks[id].disabled && context.mode === "public") && passesSchedule(blocks[id], context));
  const rendered = shown.map((id) => renderBlockComponent(blocks[id], context, id));

  return (
    <section className="w-full" {...sfProps}>
      <div className={cn(CONTAINER, "py-8 sm:py-10")}>
        {heading ? <h2 className={cn("mb-5 text-xl tracking-tight text-foreground sm:text-2xl", !left && "text-center")}>{heading}</h2> : null}
        {shown.length > 0 ? (
          <ul className={cn("flex flex-wrap items-center gap-x-6 gap-y-4", left ? "justify-start" : "justify-center")}>
            {rendered.map((out, i) => (out ? <li key={shown[i]}>{out}</li> : null))}
          </ul>
        ) : null}
        {/* Protected: always shown with the badges, outside any block style or display hook. */}
        <p className={cn("mt-4 text-xs text-muted-foreground", !left && "text-center")} data-sf-protected="trust-badges-disclaimer">{t(BADGE_DISCLAIMER_KEY)}</p>
      </div>
    </section>
  );
}
