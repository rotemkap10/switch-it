import Link from "next/link";

import { InitialShellReadyMarker } from "@/components/shell/InitialShellReadyMarker";
import { Button } from "@/components/ui/Button";

export default function HomePage() {
  return (
    <main className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-10 px-4 py-16 sm:px-6">
      <InitialShellReadyMarker />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(ellipse_at_top,_#cdeeff,_transparent_70%)]"
      />

      <div className="flex max-w-xl flex-col gap-5 motion-page-enter">
        <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Switch It
        </h1>
        <p className="text-lg font-medium leading-7 text-foreground sm:text-xl">
          Find a spot someone is leaving—or share yours when you head out.
        </p>
        <p className="max-w-lg text-base leading-7 text-muted">
          Switch It coordinates a quick public parking handoff between drivers.
          Credits are virtual points for this course MVP—not money—and the app
          never sells or guarantees a parking spot.
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

      <ul className="flex max-w-lg flex-col gap-3 text-sm leading-6 text-muted">
        <li>
          <span className="font-semibold text-foreground">Find parking</span>
          {" — "}
          claim a nearby spot and navigate there.
        </li>
        <li>
          <span className="font-semibold text-foreground">Share a spot</span>
          {" — "}
          let drivers know when you are leaving.
        </li>
        <li>
          <span className="font-semibold text-foreground">Confirm the handoff</span>
          {" — "}
          verify with a code and keep the credit loop fair.
        </li>
      </ul>
    </main>
  );
}
