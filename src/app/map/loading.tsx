export default function MapLoading() {
  return (
    <div
      className="app-shell app-shell--map"
      data-testid="map-loading-shell"
    >
      <div className="app-shell-header border-b border-border bg-surface">
        <div className="app-shell-header-inner app-shell-header-inner--wide">
          <div className="flex items-center justify-between gap-3">
            <div className="h-6 w-28 animate-pulse rounded bg-accent-soft" />
            <div className="h-8 w-8 animate-pulse rounded-full bg-accent-soft" />
          </div>
          <div className="h-11 w-full animate-pulse rounded-[var(--radius-card)] bg-accent-soft md:hidden" />
        </div>
      </div>
      <main className="app-shell-main app-shell-main--map">
        <div className="absolute inset-0 animate-pulse bg-accent-soft" />
        <p className="sr-only">Loading map…</p>
      </main>
    </div>
  );
}
