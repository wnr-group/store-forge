import { Info } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Red asterisk shown after the label of a mandatory field. Hidden from screen readers: `required` conveys it. */
export function RequiredIndicator({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn("ml-0.5 font-semibold text-error", className)}>
      *
    </span>
  );
}

type Props = {
  label: string;
  htmlFor?: string;
  /** Mandatory: shows the red asterisk. Must mirror what the schema enforces. */
  required?: boolean;
  /** Explicitly optional: shows "(Optional)". Fields that are neither are plain (e.g. toggles with a default). */
  optional?: boolean;
  /** Extra guidance shown in a tooltip next to the label. */
  help?: string;
  className?: string;
};

/** Label + required/optional indicator + optional help tooltip. */
export function FieldLabel({ label, htmlFor, required, optional, help, className }: Props) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <Label htmlFor={htmlFor} className="gap-0">
        {label}
        {required ? <RequiredIndicator /> : null}
        {optional && !required ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">(Optional)</span> : null}
      </Label>
      {required ? <span className="sr-only">(required)</span> : null}
      {help ? (
        <Tooltip>
          <TooltipTrigger
            render={<button type="button" className="rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50" aria-label={`About ${label}`} />}
          >
            <Info className="size-3.5" aria-hidden />
          </TooltipTrigger>
          <TooltipContent>{help}</TooltipContent>
        </Tooltip>
      ) : null}
    </span>
  );
}
