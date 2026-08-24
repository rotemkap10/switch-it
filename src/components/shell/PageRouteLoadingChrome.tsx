import { BrandedLoadingState } from "@/components/brand/BrandedLoadingState";
import { AppShellHeaderLoadingPlaceholder } from "@/components/layout/AppShellHeaderInner";

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
        <AppShellHeaderLoadingPlaceholder mode="none" />
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
