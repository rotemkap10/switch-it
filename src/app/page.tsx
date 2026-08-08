import Link from "next/link";

import { Logo } from "@/components/branding/Logo";
import { InitialShellReadyMarker } from "@/components/shell/InitialShellReadyMarker";
import { Button } from "@/components/ui/Button";

export default function HomePage() {
  return (
    <main className="landing-page" data-testid="landing-page">
      <InitialShellReadyMarker />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(ellipse_at_top,_#cdeeff,_transparent_70%)]"
      />

      <div className="landing-page__brand motion-page-enter">
        <h1 className="sr-only">Switch It</h1>
        <Logo variant="hero" decorative />
      </div>

      <div className="landing-page__actions">
        <Link href="/login" className="w-full">
          <Button className="w-full min-h-12">Sign in</Button>
        </Link>
        <Link href="/register" className="w-full">
          <Button variant="secondary" className="w-full min-h-12">
            Create account
          </Button>
        </Link>
      </div>
    </main>
  );
}
