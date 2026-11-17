import Image from "next/image";
import type { ComponentNode } from "@/lib/templates/document";
import type { RenderContext } from "../types";
import { imageRawPath, publicImageUrl } from "@/lib/storage/paths";

interface TestimonialBlockProps {
  node: ComponentNode;
  context: RenderContext;
  blockId?: string;
}

export function TestimonialBlock({ node, context, blockId }: TestimonialBlockProps) {
  const quote = (node.settings?.quote as string) ?? "";
  const author = (node.settings?.author as string) ?? "Customer";
  const role = (node.settings?.role as string) ?? "";
  const company = (node.settings?.company as string) ?? "";

  const avatarVal = node.settings?.avatar as { path?: string; alt?: string } | string | null | undefined;
  const rawPath = imageRawPath(avatarVal);
  const altText = typeof avatarVal === "object" ? avatarVal?.alt ?? author : author;

  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && blockId ? { "data-sf-block": blockId } : {};

  const avatarUrl = rawPath
    ? rawPath.startsWith("http://") || rawPath.startsWith("https://") || rawPath.startsWith("/")
      ? rawPath
      : publicImageUrl(rawPath)
    : null;

  return (
    <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-6 shadow-xs" {...sfProps}>
      <blockquote className="text-base italic leading-relaxed text-card-foreground">
        &ldquo;{quote}&rdquo;
      </blockquote>
      <div className="mt-6 flex items-center gap-3">
        {avatarUrl ? (
          <Image src={avatarUrl} alt={altText} width={40} height={40} className="size-10 rounded-full object-cover" />
        ) : (
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {author.charAt(0)}
          </div>
        )}
        <div>
          <div className="text-sm font-semibold text-foreground">{author}</div>
          {role || company ? (
            <div className="text-xs text-muted-foreground">
              {role}
              {role && company ? " · " : ""}
              {company}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
