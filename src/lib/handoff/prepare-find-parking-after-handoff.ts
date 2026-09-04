import { MODE_HOME, modeFromPathname } from "@/lib/mode/constants";

export type FindParkingNavigation = {
  replace: (href: string) => void;
  refresh: () => void;
  prefetch?: (href: string) => void;
};

export type FindParkingPrepareResult = "refresh" | "replace";

export function isSeekerFindParkingPath(pathname: string): boolean {
  return modeFromPathname(pathname) === "seeker";
}

/**
 * Prepare Find Parking under the completion overlay.
 *
 * Already on /map: refresh RSC (credits + claim teardown) without replacing
 * the route, so the MapLibre instance can stay mounted.
 * Other routes: prefetch + replace onto /map. Do not also refresh — the
 * destination RSC fetch is the refresh.
 */
export function prepareFindParkingAfterHandoff(
  pathname: string,
  navigation: FindParkingNavigation,
): FindParkingPrepareResult {
  if (isSeekerFindParkingPath(pathname)) {
    navigation.refresh();
    return "refresh";
  }

  try {
    navigation.prefetch?.(MODE_HOME.seeker);
  } catch {
    // Prefetch is best-effort.
  }
  navigation.replace(MODE_HOME.seeker);
  return "replace";
}
