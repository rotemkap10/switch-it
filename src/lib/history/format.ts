export type HistoryRole = "publisher" | "seeker";

export type HistoryFinalStatus = "completed" | "cancelled" | "expired";

export const HISTORY_ADDRESS_FALLBACK = "Parking location";

/** Newest-first page size for History. Further pages use Load more. */
export const HISTORY_PAGE_SIZE = 20;

export type HistoryItem = {
  id: string;
  role: HistoryRole;
  status: HistoryFinalStatus;
  address: string | null;
  atIso: string;
  creditDelta: number | null;
};

export function historyRoleLabel(role: HistoryRole): string {
  return role === "publisher" ? "You shared a spot" : "You found a spot";
}

export function historyStatusLabel(status: HistoryFinalStatus): string {
  switch (status) {
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    case "expired":
      return "Expired";
  }
}

export function historyCreditLabel(
  status: HistoryFinalStatus,
  creditDelta: number | null,
): string {
  if (status === "completed" && creditDelta != null) {
    if (creditDelta > 0) {
      return `+${creditDelta} credit`;
    }
    if (creditDelta < 0) {
      return `${creditDelta} credit`;
    }
  }
  return "No credit change";
}

function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export type HistoryDayGroup = "today" | "yesterday" | "earlier";

export function historyDayGroup(
  atIso: string,
  nowMs: number = Date.now(),
): HistoryDayGroup {
  const at = new Date(atIso);
  if (!Number.isFinite(at.getTime())) {
    return "earlier";
  }
  const today = startOfLocalDay(new Date(nowMs));
  const day = startOfLocalDay(at);
  const diffDays = Math.round((today - day) / 86_400_000);
  if (diffDays <= 0) {
    return "today";
  }
  if (diffDays === 1) {
    return "yesterday";
  }
  return "earlier";
}

export function historyDayGroupLabel(group: HistoryDayGroup): string {
  switch (group) {
    case "today":
      return "Today";
    case "yesterday":
      return "Yesterday";
    case "earlier":
      return "Earlier";
  }
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** Section heading for a history day. Older days use the calendar date. */
export function historySectionHeading(
  atIso: string,
  nowMs: number = Date.now(),
): { key: string; label: string } {
  const group = historyDayGroup(atIso, nowMs);
  if (group === "today") {
    return { key: "today", label: historyDayGroupLabel("today") };
  }
  if (group === "yesterday") {
    return { key: "yesterday", label: historyDayGroupLabel("yesterday") };
  }

  const at = new Date(atIso);
  if (!Number.isFinite(at.getTime())) {
    return { key: "unknown", label: historyDayGroupLabel("earlier") };
  }

  const key = `${at.getFullYear()}-${pad2(at.getMonth() + 1)}-${pad2(at.getDate())}`;
  const now = new Date(nowMs);
  const label = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: at.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  }).format(at);
  return { key, label };
}

/** Relative day label + local time, e.g. "Today · 14:32". */
export function formatHistoryWhen(
  atIso: string,
  nowMs: number = Date.now(),
): string {
  const at = new Date(atIso);
  if (!Number.isFinite(at.getTime())) {
    return "";
  }
  const group = historyDayGroup(atIso, nowMs);
  const time = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(at);

  if (group === "today") {
    return `Today · ${time}`;
  }
  if (group === "yesterday") {
    return `Yesterday · ${time}`;
  }
  const date = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(at);
  return `${date} · ${time}`;
}

export function groupHistoryItems(
  items: HistoryItem[],
  nowMs: number = Date.now(),
): Array<{ key: string; label: string; items: HistoryItem[] }> {
  const buckets = new Map<string, { label: string; items: HistoryItem[] }>();
  for (const item of items) {
    const heading = historySectionHeading(item.atIso, nowMs);
    const existing = buckets.get(heading.key);
    if (existing) {
      existing.items.push(item);
    } else {
      buckets.set(heading.key, { label: heading.label, items: [item] });
    }
  }
  return [...buckets.entries()].map(([key, bucket]) => ({
    key,
    label: bucket.label,
    items: bucket.items,
  }));
}
