/** Anti-flicker timings for full-page route transitions (ms). */
export const ROUTE_TRANSITION_REVEAL_DELAY_MS = 150;
export const ROUTE_TRANSITION_MIN_VISIBLE_MS = 300;
/** Last-resort cleanup if navigation never settles. */
export const ROUTE_TRANSITION_SAFETY_TIMEOUT_MS = 12_000;

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
