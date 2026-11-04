import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/(auth)/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

function initials(name: string) {
  return (
    name
      .split(/\s+|@/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "U"
  );
}

type Props = { name: string; email: string; role: string; compact?: boolean; children?: React.ReactNode };

/** Account menu. `children` lets later phases add links (e.g. profile settings) above Sign out. */
export function UserMenu({ name, email, role, compact = false, children }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          buttonVariants({ variant: "ghost" }),
          "h-auto w-full justify-start gap-2.5 px-1.5 py-1.5",
          compact && "justify-center px-0",
        )}
        aria-label="Account menu"
      >
        <Avatar className="size-7">
          <AvatarFallback className="text-[11px]">{initials(name || email)}</AvatarFallback>
        </Avatar>
        {compact ? null : (
          <span className="min-w-0 flex-1 text-left leading-tight">
            <span className="block truncate text-sm font-medium">{name || email}</span>
            <span className="block truncate text-xs font-normal capitalize text-muted-foreground">{role}</span>
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <span className="block text-sm font-medium text-foreground">{name || "Account"}</span>
            <span className="block truncate text-xs text-muted-foreground">{email}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {children}
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm outline-none hover:bg-accent focus-visible:bg-accent"
          >
            <LogOut className="size-4" aria-hidden /> Sign out
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
