import Link from "next/link";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function HomePage() {
  return (
    <main className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-10 px-4 py-16 sm:px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(circle_at_top,_#cdeeff,_transparent_70%)]"
      />

      <div className="flex max-w-2xl flex-col gap-5">
        <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Switch It
        </h1>
        <p className="max-w-xl text-base leading-7 text-muted sm:text-lg">
          Find a parking spot someone is leaving, or share yours when you head
          out. Credits are virtual points for this course MVP—not real money—and
          the app never sells or guarantees a public parking spot.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/register">
          <Button>Create account</Button>
        </Link>
        <Link href="/login">
          <Button variant="secondary">Sign in</Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            title: "Find",
            body: "See nearby spots that are about to free up.",
          },
          {
            title: "Share",
            body: "Tell others when you are leaving your spot.",
          },
          {
            title: "Confirm",
            body: "Say you got the spot and keep the credit loop fair.",
          },
        ].map((item) => (
          <Card key={item.title} className="gap-2">
            <h2 className="text-base font-semibold text-foreground">
              {item.title}
            </h2>
            <p className="text-sm leading-6 text-muted">{item.body}</p>
          </Card>
        ))}
      </div>
    </main>
  );
}
