/**
 * Short-lived suppression so local Server Action success toasts
 * are not duplicated by the matching Realtime invalidation.
 */

const untilByKey = new Map<string, number>();

export function suppressRealtimeFeedback(key: string, ttlMs = 6000): void {
  untilByKey.set(key, Date.now() + ttlMs);
}

export function isRealtimeFeedbackSuppressed(key: string): boolean {
  const until = untilByKey.get(key);
  if (until == null) {
    return false;
  }
  if (Date.now() > until) {
    untilByKey.delete(key);
    return false;
  }
  return true;
}

export function clearRealtimeFeedbackSuppression(key?: string): void {
  if (key) {
    untilByKey.delete(key);
    return;
  }
  untilByKey.clear();
}

export function realtimeFeedbackKey(
  kind: "claim" | "spot",
  id: string,
  outcome: string,
): string {
  return `${kind}:${id}:${outcome}`;
}
