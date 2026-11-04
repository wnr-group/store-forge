"use client";

import { useTransition } from "react";
import { Building2, Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { switchTenantAction } from "@/app/(dashboard)/actions";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Props = {
  activeTenantId: string;
  tenants: { id: string; name: string; role: string }[];
  storeName?: string;
  compact?: boolean;
};

/** Workspace switcher. The server re-verifies membership; the id here is only a request. */
export function TenantSwitcher({ activeTenantId, tenants, storeName, compact = false }: Props) {
  const [pending, startTransition] = useTransition();
  const active = tenants.find((t) => t.id === activeTenantId);

  const select = (id: string) => {
    if (id === activeTenantId) return;
    startTransition(async () => {
      const result = await switchTenantAction(id);
      if (result && !result.ok) toast.error(result.error);
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          buttonVariants({ variant: "outline" }),
          "h-10 w-full justify-between gap-2 border-sidebar-border bg-sidebar-accent px-2.5 text-white hover:bg-sidebar-accent/70 hover:text-white aria-expanded:bg-sidebar-accent aria-expanded:text-white",
          compact && "justify-center px-0",
        )}
        aria-label="Switch workspace"
      >
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Building2 aria-hidden />}
        {compact ? null : (
          <>
            <span className="min-w-0 flex-1 text-left leading-tight">
              <span className="block truncate text-sm">{storeName ?? active?.name ?? "Workspace"}</span>
              {storeName ? <span className="block truncate text-[11px] font-normal text-sidebar-foreground">{active?.name}</span> : null}
            </span>
            <ChevronsUpDown className="opacity-60" aria-hidden />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
          {tenants.map((t) => (
            <DropdownMenuItem key={t.id} onClick={() => select(t.id)}>
              <span className="flex-1 truncate">{t.name}</span>
              <span className="text-xs capitalize text-muted-foreground">{t.role}</span>
              {t.id === activeTenantId ? <Check aria-hidden /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
