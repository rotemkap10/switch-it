export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** Static relative phrasing; not a live-updating countdown. */
export function formatRelativeTime(value: string, now = Date.now()): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const diffMs = date.getTime() - now;
  const absMinutes = Math.round(Math.abs(diffMs) / 60_000);

  if (absMinutes < 1) {
    return diffMs >= 0 ? "in under a minute" : "just now";
  }

  if (absMinutes < 60) {
    return diffMs >= 0 ? `in ${absMinutes} min` : `${absMinutes} min ago`;
  }

  const absHours = Math.round(absMinutes / 60);
  return diffMs >= 0 ? `in ${absHours} hr` : `${absHours} hr ago`;
}
