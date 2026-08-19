/** Anti-flicker timings for full-page route transitions (ms). */
export const ROUTE_TRANSITION_REVEAL_DELAY_MS = 150;
export const ROUTE_TRANSITION_MIN_VISIBLE_MS = 300;
/** Last-resort cleanup if navigation never settles. */
export const ROUTE_TRANSITION_SAFETY_TIMEOUT_MS = 12_000;

export type RouteLoadingKind =
  | "map-seeker"
  | "map-publisher"
  | "page"
  | "auth"
  | "none";

/**
 * Destination `loading.tsx` kind. When not `"none"`, that shell owns the
 * branded loader — the generic RouteTransition overlay must not compete.
 */
export function resolveRouteLoadingKind(pathname: string): RouteLoadingKind {
  if (pathname === "/map" || pathname.startsWith("/map/")) {
    return "map-seeker";
  }
  if (pathname === "/spots/new" || pathname.startsWith("/spots/new/")) {
    return "map-publisher";
  }
  if (
    pathname === "/login" ||
    pathname === "/register" ||
    pathname.startsWith("/login/") ||
    pathname.startsWith("/register/") ||
    pathname.startsWith("/onboarding")
  ) {
    return "auth";
  }
  if (
    pathname === "/profile" ||
    pathname === "/history" ||
    pathname === "/help" ||
    pathname.startsWith("/profile/") ||
    pathname.startsWith("/history/") ||
    pathname.startsWith("/help/")
  ) {
    return "page";
  }
  return "none";
}

/**
 * Skip the full-page route overlay when the destination already has a
 * dedicated loading shell that matches final geometry.
 */
export function shouldSkipRouteTransitionOverlay(toPathname: string): boolean {
  return resolveRouteLoadingKind(toPathname) !== "none";
}

/**
 * Find Parking (`/map`) and Share a Spot compose (`/spots/new`) are both
 * full-viewport map shells. Full-page route overlays cause a second branded
 * loader in a different container — destination `loading.tsx` owns continuity.
 */
export function isMapModeHomePath(pathname: string): boolean {
  const kind = resolveRouteLoadingKind(pathname);
  return kind === "map-seeker" || kind === "map-publisher";
}

export function shouldSkipMapModeRouteOverlay(
  fromPathname: string,
  toPathname: string,
): boolean {
  return isMapModeHomePath(fromPathname) && isMapModeHomePath(toPathname);
}

export function isModifiedClick(event: {
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  button?: number;
}): boolean {
  return Boolean(
    event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      (typeof event.button === "number" && event.button !== 0),
  );
}

/**
 * Whether a click target should start an internal route transition.
 * Pure helper — no DOM side effects beyond reading attributes.
 */
export function shouldStartRouteTransition(input: {
  href: string | null;
  currentPathname: string;
  currentSearch: string;
  target?: string | null;
  download?: boolean;
  modifiedClick?: boolean;
}): boolean {
  if (input.modifiedClick) {
    return false;
  }
  if (input.download) {
    return false;
  }
  if (input.target && input.target !== "" && input.target !== "_self") {
    return false;
  }
  if (!input.href) {
    return false;
  }

  // Hash-only / fragment navigations
  if (input.href.startsWith("#")) {
    return false;
  }

  let url: URL;
  try {
    url = new URL(input.href, "http://local.invalid");
  } catch {
    return false;
  }

  // External / protocol links
  if (
    url.protocol === "mailto:" ||
    url.protocol === "tel:" ||
    url.protocol === "blob:" ||
    url.protocol === "data:"
  ) {
    return false;
  }

  // Absolute URL to another origin (when href was absolute)
  if (
    input.href.startsWith("http://") ||
    input.href.startsWith("https://") ||
    input.href.startsWith("//")
  ) {
    try {
      const absolute = new URL(
        input.href,
        typeof window !== "undefined"
          ? window.location.origin
          : "http://local.invalid",
      );
      if (
        typeof window !== "undefined" &&
        absolute.origin !== window.location.origin
      ) {
        return false;
      }
    } catch {
      return false;
    }
  }

  const nextPath = url.pathname;
  const nextSearch = url.search;
  const nextHash = url.hash;

  // Hash-only navigation on the same path+search
  if (
    nextPath === input.currentPathname &&
    nextSearch === input.currentSearch &&
    nextHash !== ""
  ) {
    return false;
  }

  // Already on this route (ignore hash differences when both empty)
  if (
    nextPath === input.currentPathname &&
    nextSearch === input.currentSearch
  ) {
    return false;
  }

  return true;
}

export function resolveAnchorHref(anchor: HTMLAnchorElement): string | null {
  const hrefAttr = anchor.getAttribute("href");
  if (hrefAttr == null || hrefAttr.trim() === "" || hrefAttr.startsWith("#")) {
    // Pure hash or empty — may still be same-page
    if (hrefAttr?.startsWith("#")) {
      return hrefAttr;
    }
    return null;
  }
  return anchor.href || hrefAttr;
}
