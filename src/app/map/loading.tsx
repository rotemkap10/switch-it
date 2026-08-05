export default function MapLoading() {
  return (
    <div className="flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border bg-surface px-4 py-2.5 sm:px-6">
        <div className="h-6 w-28 animate-pulse rounded bg-accent-soft" />
      </div>
      <main className="relative min-h-0 flex-1 overflow-hidden p-0">
        <div className="absolute inset-0 animate-pulse bg-accent-soft" />
        <p className="sr-only">Loading map…</p>
      </main>
    </div>
  );
}
