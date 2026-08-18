"use client";

import { Button } from "@/components/ui/Button";
import { logRecoverableFailure } from "@/lib/feedback/log-recoverable-failure";

type RouteErrorScreenProps = {
  title?: string;
  body?: string;
  digest?: string;
  reset?: () => void;
};

export function RouteErrorScreen({
  title = "This page couldn’t load",
  body = "Something unexpected went wrong. Reload this page or go back.",
  digest,
  reset,
}: RouteErrorScreenProps) {
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
              if (reset) {
                reset();
                return;
              }
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

export function logRouteError(error: Error & { digest?: string }, scope: string) {
  logRecoverableFailure(scope, {
    operation: "route_error_boundary",
    phase: "render",
    code: error.digest ?? error.name,
  });
}
