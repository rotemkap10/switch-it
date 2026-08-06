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
        <div className="space-y-2">
          <div className="h-7 w-32 animate-pulse rounded bg-accent-soft sm:h-8" />
          <div className="h-4 w-full max-w-md animate-pulse rounded bg-accent-soft" />
        </div>

        <div className="profile-page" data-testid="profile-compose-skeleton">
          <div className="profile-summary-grid">
            <div className="profile-summary-card animate-pulse rounded-[var(--radius-card)] bg-accent-soft" />
            <div className="profile-summary-card animate-pulse rounded-[var(--radius-card)] bg-accent-soft" />
            <div className="profile-summary-card profile-summary-email animate-pulse rounded-[var(--radius-card)] bg-accent-soft" />
          </div>

          <div className="mobile-form-section">
            <div className="h-4 w-28 animate-pulse rounded bg-accent-soft" />
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 animate-pulse rounded-full bg-accent-soft" />
                <div className="h-4 w-24 animate-pulse rounded bg-accent-soft" />
              </div>
              <div className="h-10 w-16 animate-pulse rounded bg-accent-soft" />
            </div>
          </div>

          <div className="mobile-form-section">
            <div className="h-4 w-24 animate-pulse rounded bg-accent-soft" />
            <div className="h-3 w-48 max-w-full animate-pulse rounded bg-accent-soft" />
            <div className="h-[clamp(10rem,28dvh,14rem)] animate-pulse rounded-[var(--radius-card)] bg-accent-soft" />
            <div className="mobile-form-primary h-12 animate-pulse rounded-[var(--radius-card)] bg-accent-soft" />
          </div>
        </div>
      </main>
    </div>
  );
}
