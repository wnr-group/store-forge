import { Button } from "@/components/ui/button";

/** What a shopper sees when the store cannot be loaded. Deliberately generic: no error text, no links, nothing about dashboards. */
export function StorefrontErrorState({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <div role="alert" className="space-y-2">
        <h1 className="text-xl font-semibold">This store is temporarily unavailable</h1>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">Something went wrong while loading this page. Please try again in a moment.</p>
      </div>
      <Button onClick={onRetry} disabled={retrying}>{retrying ? "Trying again…" : "Try again"}</Button>
    </main>
  );
}
