import Link from "next/link";
import { cn } from "@/lib/utils";
import { SHELL } from "./shell";
import type { SectionProps } from "..";

/** Boutique announcement bar: a slim strip of small, tracked capitals in the colours the store chose. */
export function BoutiqueAnnouncementBar({ node, context, sectionId }: SectionProps) {
  const text = (node.settings?.text as string) ?? "";
  const link = (node.settings?.link as string) ?? "";
  const backgroundColor = (node.settings?.backgroundColor as string) ?? "#10362f";
  const textColor = (node.settings?.textColor as string) ?? "#d5e3da";
  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};
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
      <div className={cn(SHELL, "flex min-h-9 items-center justify-center py-2 text-center text-[11px] font-normal uppercase leading-snug tracking-[0.12em]")}>{label}</div>
    </div>
  );
}
