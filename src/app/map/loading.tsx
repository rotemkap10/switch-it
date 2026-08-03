export default function MapLoading() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <div className="border-b border-border bg-surface px-4 py-4 sm:px-6">
        <div className="mx-auto h-6 w-28 animate-pulse rounded bg-accent-soft" />
      </div>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <div className="space-y-3">
          <div className="h-8 w-32 animate-pulse rounded bg-accent-soft" />
          <div className="h-4 w-72 animate-pulse rounded bg-accent-soft" />
        </div>
        <div className="h-[60vh] min-h-[24rem] animate-pulse rounded-[var(--radius-card)] bg-accent-soft" />
        <p className="text-sm text-muted">Loading map…</p>
      </main>
    </div>
  );
}
