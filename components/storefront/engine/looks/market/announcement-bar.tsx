import Link from "next/link";
import { renderBlockComponent } from "../../blocks";
import type { SectionProps } from "..";
import { WRAP } from "./ui";
import { cn } from "@/lib/utils";

/** Market announcement bar: a slim, dense strip of centred small text above the dark header. */
export function MarketAnnouncementBar({ node, context, sectionId }: SectionProps) {
  const text = (node.settings?.text as string) ?? "";
  const link = (node.settings?.link as string) ?? "";
  const backgroundColor = (node.settings?.backgroundColor as string) ?? "var(--secondary)";
  const textColor = (node.settings?.textColor as string) ?? "#ffffff";
  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};
  // Links, text and social icons added to the bar are drawn after its message, as on the engine bar.
  const blocks = node.blocks ?? {};
  const extras = (node.block_order ?? Object.keys(blocks)).filter((id) => blocks[id]);
  if (!text) return null;
  const label = link ? (
    <Link href={link} className="underline-offset-4 hover:underline">
      {text}
    </Link>
  ) : (
    <span>{text}</span>
  );
  return (
    <div className="w-full" style={{ backgroundColor, color: textColor }} {...sfProps}>
      <div className={cn(WRAP, "flex min-h-[28px] items-center justify-center py-1 text-center text-xs font-medium leading-snug")}>{label}
        {extras.length > 0 ? <span className="ml-4 inline-flex items-center gap-3">{extras.map((id) => renderBlockComponent(blocks[id], context, id))}</span> : null}
      </div>
    </div>
  );
}
