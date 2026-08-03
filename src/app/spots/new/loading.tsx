export default function NewSpotLoading() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <div className="border-b border-border bg-surface px-4 py-4 sm:px-6">
        <div className="mx-auto h-6 w-28 animate-pulse rounded bg-accent-soft" />
      </div>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <div className="space-y-3">
          <div className="h-8 w-48 animate-pulse rounded bg-accent-soft" />
          <div className="h-4 w-80 animate-pulse rounded bg-accent-soft" />
        </div>
        <div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-accent-soft" />
        <p className="text-sm text-muted">Loading publish form…</p>
      </main>
    </div>
  );
}
