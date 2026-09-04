/**
 * Detect stale Next.js client assets after a deploy (or a failed dynamic
 * import) and recover with a single hard reload.
 *
 * sessionStorage is per-tab. After one auto-reload, further stale errors in
 * that tab fall through to the error screen so a broken deploy cannot loop.
 */

export const STALE_CLIENT_BUILD_RECOVERY_KEY =
  "switch-it:stale-client-build-recovery";

const STALE_MESSAGE_PATTERNS = [
  /loading chunk [\w./-]+ failed/i,
  /failed to load chunk/i,
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i,
  /failed to fetch rsc payload/i,
  /an unexpected response was received from the server/i,
  /failed to load resource.*\/_next\/static\//i,
];

function asError(value: unknown): {
  name: string;
  message: string;
  cause?: unknown;
} {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      cause: value.cause,
    };
  }
  if (typeof value === "string") {
    return { name: "", message: value };
  }
  if (value && typeof value === "object") {
    const record = value as { name?: unknown; message?: unknown; cause?: unknown };
    return {
      name: typeof record.name === "string" ? record.name : "",
      message: typeof record.message === "string" ? record.message : "",
      cause: record.cause,
    };
  }
  return { name: "", message: "" };
}

function looksLikeStaleBuildText(text: string): boolean {
  if (!text) {
    return false;
  }
  if (STALE_MESSAGE_PATTERNS.some((pattern) => pattern.test(text))) {
    return true;
  }
  return (
    text.includes("/_next/static/") &&
    /failed|error|404|not found/i.test(text)
  );
}

/**
 * True for webpack/Next chunk and RSC payload failures after a new deploy.
 * False for ordinary render/auth/network exceptions.
 */
export function isStaleClientBuildError(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current != null && !seen.has(current); depth += 1) {
    seen.add(current);
    const parsed = asError(current);
    if (parsed.name === "ChunkLoadError" || parsed.name === "CSSChunkLoadError") {
      return true;
    }
    if (looksLikeStaleBuildText(`${parsed.name} ${parsed.message}`)) {
      return true;
    }
    current = parsed.cause;
  }
  return false;
}

function readRecoveryFlag(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.sessionStorage.getItem(STALE_CLIENT_BUILD_RECOVERY_KEY);
  } catch {
    return "unreadable";
  }
}

function writeRecoveryFlag(value: string): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    window.sessionStorage.setItem(STALE_CLIENT_BUILD_RECOVERY_KEY, value);
    return true;
  } catch {
    return false;
  }
}

export function canRecoverFromStaleClientBuild(): boolean {
  const flag = readRecoveryFlag();
  return flag !== "attempted" && flag !== "unreadable";
}

/**
 * One hard reload for a known stale-build error.
 * Returns true only when reload was initiated.
 */
let performHardReload = (): void => {
  window.location.reload();
};

export function recoverFromStaleClientBuildOnce(): boolean {
  if (!canRecoverFromStaleClientBuild()) {
    return false;
  }
  if (!writeRecoveryFlag("attempted")) {
    return false;
  }
  performHardReload();
  return true;
}

export function setStaleClientBuildReloadForTests(fn: (() => void) | null): void {
  performHardReload =
    fn ??
    (() => {
      window.location.reload();
    });
}

export function resetStaleClientBuildRecoveryForTests(): void {
  setStaleClientBuildReloadForTests(null);
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.removeItem(STALE_CLIENT_BUILD_RECOVERY_KEY);
  } catch {
    // jsdom without storage
  }
}

/** Strip query strings that might carry tokens from URLs in diagnostics. */
export function sanitizeClientErrorText(text: string | undefined): string {
  if (!text) {
    return "";
  }
  return text
    .replace(/https?:\/\/[^\s)'"]+/gi, (url) => {
      try {
        const parsed = new URL(url);
        return `${parsed.origin}${parsed.pathname}`;
      } catch {
        return "[url]";
      }
    })
    .slice(0, 500);
}

export function installStaleClientBuildListeners(): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  function recoverIfStale(error: unknown): boolean {
    if (!isStaleClientBuildError(error)) {
      return false;
    }
    return recoverFromStaleClientBuildOnce();
  }

  function onUnhandledRejection(event: PromiseRejectionEvent) {
    if (recoverIfStale(event.reason)) {
      event.preventDefault();
    }
  }

  function onWindowError(event: ErrorEvent) {
    if (recoverIfStale(event.error ?? event.message)) {
      event.preventDefault();
    }
  }

  window.addEventListener("unhandledrejection", onUnhandledRejection);
  window.addEventListener("error", onWindowError);
  return () => {
    window.removeEventListener("unhandledrejection", onUnhandledRejection);
    window.removeEventListener("error", onWindowError);
  };
}
