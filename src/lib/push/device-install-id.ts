const INSTALL_KEY = "switch-it:push-install-id";

export function getOrCreateDeviceInstallId(): string {
  if (typeof window === "undefined") {
    return "ssr-install";
  }
  try {
    const existing = window.localStorage.getItem(INSTALL_KEY);
    if (existing && existing.length >= 8) {
      return existing;
    }
    const created =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `install-${Date.now()}`;
    window.localStorage.setItem(INSTALL_KEY, created);
    return created;
  } catch {
    return `install-${Date.now()}`;
  }
}
