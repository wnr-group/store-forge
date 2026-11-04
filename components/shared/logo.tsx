import Link from "next/link";
import { Store } from "lucide-react";
import { APP_NAME } from "@/config/app";
import { cn } from "@/lib/utils";

export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Store className="size-4" aria-hidden />
      </span>
      <span className="text-lg">{APP_NAME}</span>
    </Link>
  );
}
