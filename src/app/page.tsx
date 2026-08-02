import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-8 px-6 py-16">
      <div className="flex flex-col gap-4">
        <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          Switch It
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-900">
          Coordinate public street parking handoffs
        </h1>
        <p className="max-w-xl text-base leading-7 text-zinc-600">
          Publish a spot you are about to leave, or claim one nearby for a
          limited time. Credits are virtual points for the course MVP—not real
          money—and the app never sells or guarantees a public parking spot.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/register"
          className="rounded bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white"
        >
          Create account
        </Link>
        <Link
          href="/login"
          className="rounded border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-900"
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
