import { accessEntries, LEVEL_LABELS } from "@/lib/auth/permissions";
import type { MemberPermissions, MembershipRole } from "@/lib/domain/enums";

/** A member's access as a short list, one module per line. Table cells do not wrap, so this sets its own width. */
export function AccessSummary({ role, permissions }: { role: MembershipRole; permissions: MemberPermissions }) {
  if (role === "owner") return <span className="text-sm text-muted-foreground">Full access</span>;
  const entries = accessEntries(role, permissions);
  if (entries.length === 0) return <span className="text-sm text-muted-foreground">No access</span>;
  return (
    <ul className="min-w-52 space-y-0.5 text-xs leading-5 whitespace-normal">
      {entries.map((e) => (
        <li key={e.module} className="flex items-baseline justify-between gap-3">
          <span className="text-muted-foreground">{e.label}</span>
          <span className="font-medium">{LEVEL_LABELS[e.level]}</span>
        </li>
      ))}
    </ul>
  );
}
