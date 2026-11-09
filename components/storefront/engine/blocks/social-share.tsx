import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext, ProductDetailData } from "../types";

interface SocialShareBlockProps {
  node: ComponentNode;
  context: RenderContext;
  blockId?: string;
}

export function SocialShareBlock({ node, context, blockId }: SocialShareBlockProps) {
  const product = context.resource as ProductDetailData | undefined;
  const title = (node.settings?.title as string) ?? "Share this product";
  const showLabels = Boolean(node.settings?.showLabels ?? true);

  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && blockId ? { "data-sf-block": blockId } : {};

  const shareText = encodeURIComponent(product?.name ?? "Check out this product");
  const shareUrl = encodeURIComponent("https://storeforge.test");

  const networks = [
    { name: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}` },
    { name: "X", href: `https://x.com/intent/tweet?text=${shareText}&url=${shareUrl}` },
    { name: "Pinterest", href: `https://pinterest.com/pin/create/button/?url=${shareUrl}&description=${shareText}` },
    { name: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}` },
  ];

  return (
    <div className="space-y-2 py-3" {...sfProps}>
      {title ? <p className="text-xs font-medium text-muted-foreground">{title}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        {networks.map((net) => (
          <a
            key={net.name}
            href={net.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
          >
            {showLabels ? net.name : "Share"}
          </a>
        ))}
      </div>
    </div>
  );
}
