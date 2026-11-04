import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Props = {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
  labelAside?: React.ReactNode;
};

/** Label + control + accessible error/hint text. Controls should set aria-describedby={`${id}-msg`}. */
export function FormField({ id, label, error, hint, className, children, labelAside }: Props) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        {labelAside}
      </div>
      {children}
      <p
        id={`${id}-msg`}
        role={error ? "alert" : undefined}
        className={cn("min-h-4 text-xs", error ? "text-destructive" : "text-muted-foreground")}
      >
        {error ?? hint}
      </p>
    </div>
  );
}
