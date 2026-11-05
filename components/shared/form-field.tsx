import { FieldLabel } from "@/components/shared/field-label";
import { cn } from "@/lib/utils";

type Props = {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
  labelAside?: React.ReactNode;
  /** Mandatory field: red asterisk. Keep in sync with the schema. */
  required?: boolean;
  /** Optional field: "(Optional)" next to the label. */
  optional?: boolean;
  /** Tooltip help next to the label. */
  help?: string;
};

/**
 * Label + control + accessible error/hint text. Controls should set aria-invalid and
 * aria-describedby={`${id}-msg`}. Errors are announced (role="alert") and styled with the error token.
 */
export function FormField({ id, label, error, hint, className, children, labelAside, required, optional, help }: Props) {
  return (
    <div className={cn("space-y-1.5", className)} data-invalid={error ? "true" : undefined}>
      <div className="flex items-center justify-between">
        <FieldLabel label={label} htmlFor={id} required={required} optional={optional} help={help} />
        {labelAside}
      </div>
      {children}
      <p
        id={`${id}-msg`}
        role={error ? "alert" : undefined}
        className={cn("min-h-4 text-xs", error ? "text-error" : "text-muted-foreground")}
      >
        {error ?? hint}
      </p>
    </div>
  );
}
