import Link from "next/link";
import { cn } from "@/lib/utils";
import type { SectionProps } from "..";
import { SHELL } from "./ui";

/** Sport announcement bar: a slim navy strip with centred, semi-bold white text. */
export function SportAnnouncementBar({ node, context, sectionId }: SectionProps) {
  const text = (node.settings?.text as string) ?? "";
  const link = (node.settings?.link as string) ?? "";
  const backgroundColor = (node.settings?.backgroundColor as string) ?? "var(--primary)";
  const textColor = (node.settings?.textColor as string) ?? "#ffffff";
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
      <div className={cn(SHELL, "flex min-h-[31px] items-center justify-center py-1.5 text-center text-[14px] font-semibold leading-snug")}>{label}</div>
    </div>
  );
}
