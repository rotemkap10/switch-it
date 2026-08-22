/* Client root: redirects authenticated users before showing landing. */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import Link from "next/link";

import { Logo } from "@/components/branding/Logo";
import { InitialShellReadyMarker } from "@/components/shell/InitialShellReadyMarker";
import { Button } from "@/components/ui/Button";

import { createClient } from "@/lib/supabase/client";

type SessionCheckState = "checking" | "ready";

export default function HomePage() {
  const router = useRouter();
  const [state, setState] = useState<SessionCheckState>("checking");

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return;

        if (data.session) {
          router.replace("/map");
          return;
        }

        setState("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setState("ready");
      });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;

      if (session) {
        router.replace("/map");
        return;
      }

      setState("ready");
    });

    return () => {
      cancelled = true;
      data.subscription?.unsubscribe?.();
    };
  }, [router]);

  if (state === "checking") {
    // Keep the branded cold-launch splash covering. Do NOT report shell ready
    // here — that used to release the logo into a blank Porcelain screen before
    // /map could request await-initial-map, then the car loader appeared.
    return (
      <div
        data-testid="home-auth-routing"
        aria-hidden="true"
        className="min-h-dvh w-full bg-transparent"
      />
    );
  }

  return (
    <main className="landing-page" data-testid="landing-page">
      <InitialShellReadyMarker />

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
