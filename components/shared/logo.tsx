import Image from "next/image";
import Link from "next/link";
import { APP_NAME } from "@/config/app";
import { cn } from "@/lib/utils";
import { KanovaLockup } from "./kanova-lockup";

const LINK = "inline-flex items-center gap-2 rounded-md font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * App logo. By default the full Kanova Store logo (the K mark image with live text), or just the K mark when `compact` (a
 * collapsed sidebar). An uploaded platform logo is shown with the platform name beside it instead.
 */
export function Logo({ className, href = "/", name = APP_NAME, logoUrl, compact = false }: { className?: string; href?: string; name?: string; logoUrl?: string | null; compact?: boolean }) {
  if (!logoUrl) {
    return (
      <Link href={href} aria-label={`${name}, home`} className={cn(LINK, className)}>
        {compact ? <Image src="/kanova-mark.png" alt="" aria-hidden width={230} height={279} className="h-7 w-auto shrink-0" /> : <KanovaLockup className="h-9 text-sidebar-foreground" />}
      </Link>
    );
  }
  return (
    <Link href={href} className={cn(LINK, className)}>
      <Image src={logoUrl} alt="" aria-hidden width={160} height={48} unoptimized className="h-6 w-auto max-w-32 shrink-0 object-contain" />
      {compact ? null : <span className="text-lg">{name}</span>}
    </Link>
  );
}
