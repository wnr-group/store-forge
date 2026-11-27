/** Shown while a catalog page loads: the title, a row of tiles and a grid of parts, in the store's own colours. */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[var(--sf-page-width,80rem)] animate-pulse px-4 py-10 sm:px-6 lg:px-8" role="status" aria-label="Loading catalog">
      <div className="h-3 w-48 rounded bg-muted" />
      <div className="mt-6 h-9 w-72 max-w-full rounded bg-muted" />
      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-24 rounded-[var(--radius,0.5rem)] bg-muted" />
        ))}
      </div>
      <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="space-y-2">
            <div className="aspect-[4/5] rounded-[var(--radius,0.5rem)] bg-muted" />
            <div className="h-3 w-3/4 rounded bg-muted" />
            <div className="h-3 w-1/3 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
