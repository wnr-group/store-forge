import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Props = { title: string; description?: string; children: React.ReactNode; className?: string; aside?: React.ReactNode };

/** A titled group of related fields, used to keep long forms scannable. */
export function SectionCard({ title, description, children, className, aside }: Props) {
  return (
    <Card className={cn("gap-4", className)}>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {aside}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}
