import Image from "next/image";
import Link from "next/link";
import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext } from "../types";
import { RichText } from "../richtext-renderer";
import { publicImageUrl } from "@/lib/storage/paths";

interface ColumnBlockProps {
  node: ComponentNode;
  context: RenderContext;
  blockId?: string;
}

export function ColumnBlock({ node, context, blockId }: ColumnBlockProps) {
  const imageVal = node.settings?.image as { path?: string; alt?: string } | string | null | undefined;
  const rawPath = typeof imageVal === "string" ? imageVal : imageVal?.path;
  const altText = typeof imageVal === "object" ? imageVal?.alt ?? "" : "";

  const title = (node.settings?.title as string) ?? "";
  const text = (node.settings?.text as string) ?? "";
  const linkLabel = (node.settings?.linkLabel as string) ?? "";
  const linkUrl = (node.settings?.linkUrl as string) ?? "";

  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && blockId ? { "data-sf-block": blockId } : {};

  const imageUrl = rawPath
    ? rawPath.startsWith("http://") || rawPath.startsWith("https://") || rawPath.startsWith("/")
      ? rawPath
      : publicImageUrl(rawPath)
    : null;

  return (
    <div className="flex flex-col space-y-3" {...sfProps}>
      {imageUrl ? (
        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted">
          <Image src={imageUrl} alt={altText} fill sizes="(min-width: 1024px) 33vw, 100vw" className="object-cover" />
        </div>
      ) : null}
      {title ? <h3 className="text-lg font-semibold tracking-tight text-foreground">{title}</h3> : null}
      {text ? <RichText content={text} className="text-sm text-muted-foreground" /> : null}
      {linkLabel && linkUrl ? (
        <Link href={linkUrl} className="inline-flex items-center text-sm font-medium text-primary hover:underline">
          {linkLabel} &rarr;
        </Link>
      ) : null}
    </div>
  );
}
