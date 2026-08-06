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
        <div className="flex flex-col gap-2">
          <div className="h-7 w-36 animate-pulse rounded bg-accent-soft sm:h-8" />
          <div className="h-4 w-full max-w-sm animate-pulse rounded bg-accent-soft" />
        </div>

        <div
          className="publisher-compose mx-auto w-full max-w-lg md:max-w-xl"
          data-testid="spots-new-compose-skeleton"
        >
          <div className="publisher-compose-surface">
            <div
              className="leaver-map-picker-shell w-full animate-pulse rounded-[var(--radius-card)] bg-accent-soft"
              aria-hidden="true"
            />
            <div className="h-4 w-32 animate-pulse rounded bg-accent-soft" />
            <div className="publisher-leave-time-grid" aria-hidden="true">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="publisher-leave-time-chip animate-pulse border-transparent bg-accent-soft"
                />
              ))}
            </div>
            <div className="publisher-share-cta h-12 w-full animate-pulse rounded-[var(--radius-card)] bg-accent-soft" />
          </div>
        </div>
      </main>
    </div>
  );
}
