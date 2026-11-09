import Link from "next/link";
import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext } from "../types";

interface ButtonBlockProps {
  node: ComponentNode;
  context: RenderContext;
  blockId?: string;
}

export function ButtonBlock({ node, context, blockId }: ButtonBlockProps) {
  const label = (node.settings?.label as string) ?? "Shop now";
  const link = (node.settings?.link as string) ?? "/";
  const style = (node.settings?.style as string) ?? "primary";
  const openInNewTab = Boolean(node.settings?.openInNewTab);

  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && blockId ? { "data-sf-block": blockId } : {};

  const baseStyle = "inline-flex items-center justify-center rounded-md px-5 py-2.5 text-sm font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring";
  let variantStyle = "bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs";

  if (style === "secondary") {
    variantStyle = "bg-secondary text-secondary-foreground hover:bg-secondary/80";
  } else if (style === "outline") {
    variantStyle = "border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground";
  }

  const targetProps = openInNewTab ? { target: "_blank", rel: "noopener noreferrer" } : {};

  return (
    <div className="pt-2" {...sfProps}>
      <Link href={link || "/"} className={`${baseStyle} ${variantStyle}`} {...targetProps}>
        {label}
      </Link>
    </div>
  );
}
