import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  icon?: React.ReactNode;
};

export function AuthShell({ title, description, children, footer, icon }: Props) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10">
      <Logo className="mb-6" />
      <Card className="w-full max-w-md">
        <CardHeader>
          {icon ? (
            <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-muted text-foreground">
              {icon}
            </div>
          ) : null}
          <CardTitle className="text-xl">{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
        <CardContent className="space-y-4">{children}</CardContent>
      </Card>
      {footer ? <div className="mt-5 text-center text-sm text-muted-foreground">{footer}</div> : null}
      <p className="mt-8 text-xs text-muted-foreground">
        <Link href="/" className="underline-offset-4 hover:underline">
          Back to home
        </Link>
      </p>
    </div>
  );
}
