import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext } from "../types";

interface SocialLinkBlockProps {
  node: ComponentNode;
  context: RenderContext;
  blockId?: string;
}

export function SocialLinkBlock({ node, context, blockId }: SocialLinkBlockProps) {
  const network = (node.settings?.network as string) ?? "instagram";
  const url = (node.settings?.url as string) ?? "https://instagram.com";

  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && blockId ? { "data-sf-block": blockId } : {};

  const networkNames: Record<string, string> = {
    facebook: "Facebook",
    instagram: "Instagram",
    x: "X",
    twitter: "Twitter",
    pinterest: "Pinterest",
    tiktok: "TikTok",
    youtube: "YouTube",
    linkedin: "LinkedIn",
  };

  const displayName = networkNames[network] ?? network;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      {...sfProps}
    >
      <span>{displayName}</span>
    </a>
  );
}
