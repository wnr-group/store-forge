import Image from "next/image";
import Link from "next/link";
import { APP_NAME } from "@/config/app";
import { cn } from "@/lib/utils";

/** Brand mark: gold handshake with a rising arrow (public/logo.png, transparent). Wordmark in the UI family. */
function LogoMark({ className, logoUrl }: { className?: string; logoUrl?: string | null }) {
  // The uploaded platform logo (any shape, so it is only height-limited); otherwise the built-in mark.
  if (logoUrl) return <Image src={logoUrl} alt="" aria-hidden width={160} height={48} unoptimized className={cn("h-6 w-auto max-w-32 shrink-0 object-contain", className)} />;
  return <Image src="/logo.png" alt="" aria-hidden width={256} height={217} className={cn("h-6 w-auto shrink-0", className)} />;
}

export function Logo({ className, href = "/", name = APP_NAME, logoUrl }: { className?: string; href?: string; name?: string; logoUrl?: string | null }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md", className)}>
      <LogoMark logoUrl={logoUrl} />
      <span className="text-lg">{name}</span>
    </Link>
  );
}
