import { publicImageUrl } from "@/lib/storage/paths";
import type { SectionProps } from "..";
import { SportHeroBanner } from "./hero-banner";
import { renderBlockComponent } from "../../blocks";
import { SHELL } from "./ui";
import { cn } from "@/lib/utils";

/** Sport collection page banner: breadcrumb, the collection name in two tones, its description and picture. */
export function SportCollectionBanner({ node, context, sectionId }: SectionProps) {
  const c = context.resource as { name?: string; description?: string | null; image_path?: string | null } | undefined;
  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : undefined;
  if (!c?.name) return null;
  const showText = Boolean(node.settings?.showCollectionDescription ?? true);
  const showImage = Boolean(node.settings?.showCollectionImage ?? true);
  const blocks = node.blocks ?? {};
  const ids = (node.block_order ?? Object.keys(blocks)).filter((id) => blocks[id] && !(blocks[id].disabled && context.mode === "public"));
  const banner = <SportHeroBanner title={c.name} text={showText ? (c.description ?? undefined) : undefined} imageUrl={showImage ? publicImageUrl(c.image_path) : null} crumbs={[{ label: "Home", href: "/" }, { label: "Collections", href: "/collections" }, { label: c.name }]} sfProps={sfProps} />;
  if (ids.length === 0) return banner;
  return (
    <>
      {banner}
      <div className={cn(SHELL, "flex flex-col gap-2 pt-4")}>{ids.map((id) => renderBlockComponent(blocks[id], context, id))}</div>
    </>
  );
}
