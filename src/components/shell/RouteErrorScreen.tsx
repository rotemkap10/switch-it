"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/Button";
import { logRecoverableFailure } from "@/lib/feedback/log-recoverable-failure";
import {
  canRecoverFromStaleClientBuild,
  isStaleClientBuildError,
  recoverFromStaleClientBuildOnce,
  sanitizeClientErrorText,
} from "@/lib/navigation/stale-client-build";

type RouteErrorScreenProps = {
  title?: string;
  body?: string;
  digest?: string;
  error?: Error & { digest?: string };
  logScope?: string;
};

function safePathname(): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  return window.location.pathname;
}

export function logRouteError(
  error: Error & { digest?: string },
  scope: string,
) {
  const pathname = safePathname();
  logRecoverableFailure(scope, {
    operation: "route_error_boundary",
    phase: "render",
    code: error.digest ?? error.name,
    route: pathname,
  });
  console.error(`[switch-it] ${scope}`, {
    name: error.name,
    message: sanitizeClientErrorText(error.message),
    digest: error.digest ?? null,
    pathname: pathname ?? null,
    hidden:
      typeof document !== "undefined" ? document.visibilityState === "hidden" : null,
    online: typeof navigator !== "undefined" ? navigator.onLine : null,
    staleClientBuild: isStaleClientBuildError(error),
    stack: sanitizeClientErrorText(error.stack),
  });
}

export function RouteErrorScreen({
  title = "This page couldn’t load",
  body = "Something unexpected went wrong. Reload this page or go back.",
  digest,
  error,
  logScope = "error-boundary",
}: RouteErrorScreenProps) {
  const stale = error ? isStaleClientBuildError(error) : false;
  const recovering = stale && canRecoverFromStaleClientBuild();

  useEffect(() => {
    if (!error) {
      return;
    }
    logRouteError(error, logScope);
    if (isStaleClientBuildError(error)) {
      recoverFromStaleClientBuildOnce();
    }
  }, [error, logScope]);

  if (recovering) {
    return (
      <main
        className="offline-page motion-fade-slide-up"
        data-testid="stale-client-build-recovery"
      >
        <div className="offline-page__card">
          <h1 className="offline-page__title">Refreshing…</h1>
          <p className="offline-page__body">
            Updating to the latest version of Switch It.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="offline-page motion-fade-slide-up" data-testid="route-error-screen">
      <div className="offline-page__card">
        <h1 className="offline-page__title">{title}</h1>
        <p className="offline-page__body">{body}</p>
        {digest ? (
          <p className="text-xs text-muted" data-testid="route-error-digest">
            Error code {digest}
          </p>
        ) : null}
        <div className="mt-2 flex flex-col gap-2">
          <Button
            type="button"
            className="offline-page__retry w-full"
            onClick={() => {
              window.location.reload();
            }}
          >
            Reload
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() => {
              if (window.history.length > 1) {
                window.history.back();
                return;
              }
              window.location.assign("/map");
            }}
          >
            Back
          </Button>
        </div>
      </div>
    </main>
  );
}
