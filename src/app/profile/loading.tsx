export default function ProfileLoading() {
  return (
    <div className="app-shell" data-testid="profile-loading-shell">
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
          <div className="h-8 w-40 animate-pulse rounded bg-accent-soft" />
          <div className="h-4 w-64 max-w-full animate-pulse rounded bg-accent-soft" />
        </div>
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-[var(--app-card-gap)]">
          <div className="grid gap-[var(--app-card-gap)] sm:grid-cols-3">
            <div className="h-[9.5rem] animate-pulse rounded-[var(--radius-card)] bg-accent-soft" />
            <div className="h-[9.5rem] animate-pulse rounded-[var(--radius-card)] bg-accent-soft" />
            <div className="h-[9.5rem] animate-pulse rounded-[var(--radius-card)] bg-accent-soft" />
          </div>
          <div className="h-[5.5rem] animate-pulse rounded-[var(--radius-card)] bg-accent-soft" />
          <div className="h-[22rem] animate-pulse rounded-[var(--radius-card)] bg-accent-soft sm:h-[24rem]" />
        </div>
        <p className="text-sm text-muted">Loading profile…</p>
      </main>
    </div>
  );
}
