import { BrandedLoadingState } from "@/components/brand/BrandedLoadingState";

type PageRouteLoadingChromeProps = {
  /** Test id for the outer shell. */
  testId?: string;
  /** Optional map-height shell (seeker map route). */
  mapLayout?: boolean;
};

/**
 * Shared App Router loading.tsx chrome — driving-car loader, not skeletons or spinners.
 * Matches authenticated page shell (`app-shell` + header), not map or auth layouts.
 */
export function PageRouteLoadingChrome({
  testId = "page-route-loading-shell",
  mapLayout = false,
}: PageRouteLoadingChromeProps) {
  return (
    <div
      className={["app-shell", mapLayout ? "app-shell--map" : ""].join(" ")}
      data-testid={testId}
      data-layout={mapLayout ? "map" : "page"}
    >
      <div className="app-shell-header border-b border-border bg-surface">
        <div
          className={[
            "app-shell-header-inner",
            mapLayout
              ? "app-shell-header-inner--wide"
              : "app-shell-header-inner--contained",
          ].join(" ")}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold tracking-tight text-foreground">
              Switch It
            </p>
            <div
              className="h-8 w-8 rounded-full bg-accent-soft"
              aria-hidden="true"
            />
          </div>
          <div
            className="h-[var(--app-tap-min)] w-full rounded-[var(--radius-card)] border border-border bg-accent-soft md:hidden"
            aria-hidden="true"
          />
        </div>
      </div>
      <main
        className={[
          "app-shell-main",
          mapLayout ? "app-shell-main--map" : "app-shell-main--page",
        ].join(" ")}
      >
        <BrandedLoadingState
          label="Loading…"
          variant="page"
          ariaLabel="Loading page"
        />
      </main>
    </div>
  );
}
