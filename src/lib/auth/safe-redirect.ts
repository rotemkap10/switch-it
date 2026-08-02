const DEFAULT_REDIRECT = "/map";

/**
 * Accept only same-origin relative paths for post-auth redirects.
 */
export function getSafeRedirectPath(next: string | null | undefined): string {
  if (!next) {
    return DEFAULT_REDIRECT;
  }

  if (!next.startsWith("/")) {
    return DEFAULT_REDIRECT;
  }

  if (next.startsWith("//")) {
    return DEFAULT_REDIRECT;
  }

  if (next.includes("://")) {
    return DEFAULT_REDIRECT;
  }

  return next;
}
