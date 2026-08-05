export default function ProfileLoading() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <div className="border-b border-border bg-surface px-4 py-4 sm:px-6">
        <div className="mx-auto h-6 w-28 animate-pulse rounded bg-accent-soft" />
      </div>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <div className="space-y-3">
          <div className="h-8 w-40 animate-pulse rounded bg-accent-soft" />
          <div className="h-4 w-64 animate-pulse rounded bg-accent-soft" />
        </div>
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 sm:gap-5">
          <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
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
