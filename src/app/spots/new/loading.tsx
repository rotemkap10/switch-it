export default function NewSpotLoading() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <div className="h-6 w-28 animate-pulse rounded bg-zinc-200" />
      <div className="space-y-3">
        <div className="h-8 w-48 animate-pulse rounded bg-zinc-200" />
        <div className="h-4 w-72 animate-pulse rounded bg-zinc-200" />
      </div>
      <div className="h-64 animate-pulse rounded bg-zinc-200" />
      <p className="text-sm text-zinc-500">Loading publish form…</p>
    </main>
  );
}
