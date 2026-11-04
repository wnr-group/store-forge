import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/(auth)/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

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

export function UserMenu({ name, email }: { name: string; email: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right leading-tight sm:block">
        <p className="text-sm font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">{email}</p>
      </div>
      <Avatar>
        <AvatarFallback>{initials(name || email)}</AvatarFallback>
      </Avatar>
      <form action={logoutAction}>
        <Button type="submit" variant="outline" size="icon" aria-label="Sign out" title="Sign out">
          <LogOut aria-hidden />
        </Button>
      </form>
    </div>
  );
}
