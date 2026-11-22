import Image from "next/image";
import Link from "next/link";
import { Clock, Gift, Headphones, Heart, Leaf, MapPin, Package, RotateCcw, Sparkles, Star, ThumbsUp, Truck, type LucideIcon } from "lucide-react";
import { t } from "@/lib/i18n/messages";
import type { ComponentNode } from "@/lib/templates/document";
import { publicImageUrl } from "@/lib/storage/paths";
import { isBadgeIcon, isPresetBadge, presetMessageKey, readBadgeSettings, safeBadgeLink, validateBadgeSettings, type BadgeIcon, type PresetBadge } from "@/lib/templates/trust-badges";
import type { RenderContext } from "../types";
import { blockMarkers } from "../markers";

const ICONS: Record<BadgeIcon, LucideIcon> = {
  truck: Truck,
  "rotate-ccw": RotateCcw,
  package: Package,
  gift: Gift,
  heart: Heart,
  leaf: Leaf,
  star: Star,
  clock: Clock,
  "thumbs-up": ThumbsUp,
  sparkles: Sparkles,
  "map-pin": MapPin,
  headphones: Headphones,
};

const PRESET_ICON: Record<PresetBadge, BadgeIcon> = { "free-shipping": "truck", "easy-returns": "rotate-ccw", "secure-packaging": "package", "quality-checked": "sparkles" };

/**
 * One trust badge. A badge that fails the wording, icon, image or link rules is not drawn on the storefront (fail closed); the editor
 * shows a note so it can be fixed.
 */
export function TrustBadgeBlock({ node, context, blockId }: { node: ComponentNode; context: RenderContext; blockId?: string }) {
  const b = readBadgeSettings(node.settings);
  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = blockMarkers(blockId, isPreview, node);

  if (Object.keys(validateBadgeSettings(node.settings)).length > 0) {
    if (!isPreview) return null;
    return <span className="rounded border border-dashed border-amber-500 px-2 py-1 text-xs text-amber-900" {...sfProps}>Finish this badge to show it.</span>;
  }

  let inner: React.ReactNode;
  if (b.kind === "upload") {
    const url = publicImageUrl(b.markPath) ?? (b.markPath.startsWith("/") || b.markPath.startsWith("https://") ? b.markPath : null);
    inner = url ? <Image src={url} alt={b.markAlt} width={96} height={48} className="h-10 w-auto object-contain" /> : null;
  } else {
    const icon = b.kind === "preset" ? PRESET_ICON[b.preset as PresetBadge] : (b.icon as BadgeIcon);
    const Icon = isBadgeIcon(icon) ? ICONS[icon] : Star;
    const label = b.kind === "preset" && isPresetBadge(b.preset) ? t(presetMessageKey(b.preset)) : b.text;
    inner = (
      <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
        <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        <span>{label}</span>
      </span>
    );
  }
  if (!inner) return null;

  const href = safeBadgeLink(b.link);
  if (!href) return <div {...sfProps}>{inner}</div>;
  const external = href.startsWith("https://");
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="hover:underline" {...sfProps}>{inner}</a>
  ) : (
    <Link href={href} className="hover:underline" {...sfProps}>{inner}</Link>
  );
}
