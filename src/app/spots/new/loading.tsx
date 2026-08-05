export default function NewSpotLoading() {
  return (
    <div className="app-shell" data-testid="spots-new-loading-shell">
      <div className="app-shell-header border-b border-border bg-surface">
        <div className="app-shell-header-inner app-shell-header-inner--contained">
          <div className="flex items-center justify-between gap-3">
            <div className="h-6 w-28 animate-pulse rounded bg-accent-soft" />
            <div className="h-8 w-8 animate-pulse rounded-full bg-accent-soft" />
          </div>
          <div className="h-11 w-full animate-pulse rounded-[var(--radius-card)] bg-accent-soft md:hidden" />
        </div>
      </div>
      <main className="app-shell-main app-shell-main--page">
        <div className="space-y-3">
          <div className="h-8 w-48 animate-pulse rounded bg-accent-soft" />
          <div className="h-4 w-64 max-w-full animate-pulse rounded bg-accent-soft" />
        </div>
        <div className="h-64 max-w-full animate-pulse rounded-[var(--radius-card)] bg-accent-soft" />
        <p className="text-sm text-muted">Loading publish form…</p>
      </main>
    </div>
  );
}
