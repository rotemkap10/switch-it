"use client";

import { useEffect } from "react";

import {
  logRouteError,
  RouteErrorScreen,
} from "@/components/shell/RouteErrorScreen";
import { PWA_BACKGROUND_COLOR } from "@/lib/pwa/brand-colors";
import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logRouteError(error, "global-error-boundary");
  }, [error]);

  return (
    <html lang="en" style={{ backgroundColor: PWA_BACKGROUND_COLOR }}>
      <body
        className="flex min-h-dvh flex-col bg-background text-foreground"
        style={{ backgroundColor: PWA_BACKGROUND_COLOR }}
      >
        <RouteErrorScreen digest={error.digest} reset={reset} />
      </body>
    </html>
  );
}
