import Link from "next/link";
import { APP_NAME } from "@/config/app";
import { cn } from "@/lib/utils";

/** Flat mark: three shelf bars of stepped length. Wordmark in the UI family. */
function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-6 shrink-0", className)}>
      <rect width="32" height="32" rx="7" className="fill-primary" />
      <rect x="8" y="9" width="16" height="3.5" rx="1.75" className="fill-primary-foreground" />
      <rect x="8" y="14.25" width="12" height="3.5" rx="1.75" className="fill-primary-foreground" />
      <rect x="8" y="19.5" width="8" height="3.5" rx="1.75" className="fill-primary-foreground" />
    </svg>
  );
}

export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md", className)}>
      <LogoMark />
      <span className="text-lg">{APP_NAME}</span>
    </Link>
  );
}
