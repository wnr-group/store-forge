import Image from "next/image";
import type { CSSProperties } from "react";
import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext } from "../types";
import { publicImageUrl } from "@/lib/storage/paths";

interface ImageBlockProps {
  node: ComponentNode;
  context: RenderContext;
  blockId?: string;
}

export function ImageBlock({ node, context, blockId }: ImageBlockProps) {
  const imageValue = node.settings?.image as
    | { path?: string; alt?: string; focal?: { x: number; y: number } }
    | string
    | null
    | undefined;

  const rawPath = typeof imageValue === "string" ? imageValue : imageValue?.path;
  const altText = (typeof imageValue === "object" && imageValue?.alt !== undefined && imageValue?.alt !== null)
    ? imageValue.alt
    : "";

  const focal = typeof imageValue === "object" ? imageValue?.focal : undefined;
  const aspectRatioSetting = (node.settings?.aspectRatio as string) ?? "auto";
  const objectFitSetting = (node.settings?.objectFit as string) ?? "cover";
  const widthSetting = (node.settings?.width as string) ?? "full";
  const alignmentSetting = (node.settings?.alignment as string) ?? "center";

  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && blockId ? { "data-sf-block": blockId } : {};

  if (!rawPath) {
    if (isPreview) {
      return (
        <div
          className="flex aspect-video w-full items-center justify-center rounded-lg border border-dashed border-muted-foreground/30 bg-muted/40 text-xs text-muted-foreground"
          {...sfProps}
        >
          No image selected
        </div>
      );
    }
    return null;
  }

  const imageUrl = rawPath.startsWith("http://") || rawPath.startsWith("https://") || rawPath.startsWith("/")
    ? rawPath
    : publicImageUrl(rawPath);

  if (!imageUrl) return null;

  const alignClass =
    alignmentSetting === "left"
      ? "mr-auto"
      : alignmentSetting === "right"
      ? "ml-auto"
      : "mx-auto";

  let widthClass = "w-full";
  if (widthSetting === "large") widthClass = "w-3/4";
  else if (widthSetting === "medium") widthClass = "w-1/2";
  else if (widthSetting === "small") widthClass = "w-1/4";

  let ratioStyle: string | undefined = undefined;
  if (aspectRatioSetting === "1/1") ratioStyle = "1 / 1";
  else if (aspectRatioSetting === "16/9") ratioStyle = "16 / 9";
  else if (aspectRatioSetting === "4/3") ratioStyle = "4 / 3";
  else if (aspectRatioSetting === "3/4") ratioStyle = "3 / 4";

  const imageStyles: CSSProperties = {
    objectFit: (objectFitSetting as CSSProperties["objectFit"]) ?? "cover",
    ...(focal ? { objectPosition: `${focal.x}% ${focal.y}%` } : {}),
    ...(ratioStyle ? { aspectRatio: ratioStyle } : {}),
  };

  return (
    <div className={`overflow-hidden rounded-lg ${widthClass} ${alignClass}`} {...sfProps}>
      <div className="relative w-full" style={ratioStyle ? { aspectRatio: ratioStyle } : undefined}>
        <Image
          src={imageUrl}
          alt={altText}
          fill={Boolean(ratioStyle)}
          width={ratioStyle ? undefined : 1200}
          height={ratioStyle ? undefined : 800}
          sizes="(min-width: 1024px) 800px, 100vw"
          className="h-auto w-full object-cover"
          style={imageStyles}
        />
      </div>
    </div>
  );
}
