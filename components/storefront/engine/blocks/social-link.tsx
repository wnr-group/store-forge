import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext } from "../types";
import { blockMarkers } from "../markers";
import { SocialIcon } from "./social-icons";

interface SocialLinkBlockProps {
  node: ComponentNode;
  context: RenderContext;
  blockId?: string;
}

export function SocialLinkBlock({ node, context, blockId }: SocialLinkBlockProps) {
  const network = (node.settings?.network as string) ?? "instagram";
  const url = (node.settings?.url as string) ?? "https://instagram.com";

  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = blockMarkers(blockId, isPreview, node);

  const networkNames: Record<string, string> = {
    facebook: "Facebook",
    instagram: "Instagram",
    x: "X",
    twitter: "Twitter",
    pinterest: "Pinterest",
    youtube: "YouTube",
    linkedin: "LinkedIn",
  };

  const displayName = networkNames[network] ?? network;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-full border border-current/20 px-3.5 py-1.5 text-sm text-muted-foreground transition-colors hover:border-current/50 hover:text-foreground"
      {...sfProps}
    >
      <SocialIcon network={network} className="size-4 shrink-0" />
      <span>{displayName}</span>
    </a>
  );
}
