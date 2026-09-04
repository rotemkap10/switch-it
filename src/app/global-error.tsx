"use client";

import { RouteErrorScreen } from "@/components/shell/RouteErrorScreen";
import { PWA_BACKGROUND_COLOR } from "@/lib/pwa/brand-colors";
import "./globals.css";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" style={{ backgroundColor: PWA_BACKGROUND_COLOR }}>
      <body
        className="flex min-h-dvh flex-col bg-background text-foreground"
        style={{ backgroundColor: PWA_BACKGROUND_COLOR }}
      >
        <RouteErrorScreen
          error={error}
          digest={error.digest}
          logScope="global-error-boundary"
        />
      </body>
    </html>
  );
}
