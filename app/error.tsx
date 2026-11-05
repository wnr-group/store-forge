"use client";

import { AlertTriangle } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // The message is intentionally not rendered: server errors may contain internals.
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <AlertTriangle className="size-10 text-muted-foreground" aria-hidden />
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        We could not load this page. If you are signed in to several workspaces, check you still have access.
      </p>
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <a href="/dashboard" className={buttonVariants({ variant: "outline" })}>
          Go to dashboard
        </a>
      </div>
    </div>
  );
}
