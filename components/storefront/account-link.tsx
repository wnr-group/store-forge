import Link from "next/link";
import { CircleUserRound } from "lucide-react";

/**
 * The shopper's way into their account (orders, tracking, saved addresses) from a store's header. Owners sign in at /login. Needs no session to render: the
 * account pages themselves ask a visitor who is not signed in to sign in first.
 */
export function AccountLink({ className, iconClassName = "size-[19px]", strokeWidth = 1.4, children }: { className?: string; iconClassName?: string; strokeWidth?: number; children?: React.ReactNode }) {
  return (
    <Link href="/account" prefetch={false} aria-label="My account" title="My account" className={className}>
      <CircleUserRound className={iconClassName} strokeWidth={strokeWidth} aria-hidden />
      {children}
    </Link>
  );
}
