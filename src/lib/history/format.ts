export type HistoryRole = "publisher" | "seeker";

export type HistoryFinalStatus = "completed" | "cancelled" | "expired";

export const HISTORY_ADDRESS_FALLBACK = "Parking location";

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
): Array<{ group: HistoryDayGroup; items: HistoryItem[] }> {
  const buckets: Record<HistoryDayGroup, HistoryItem[]> = {
    today: [],
    yesterday: [],
    earlier: [],
  };
  for (const item of items) {
    buckets[historyDayGroup(item.atIso, nowMs)].push(item);
  }
  const order: HistoryDayGroup[] = ["today", "yesterday", "earlier"];
  return order
    .filter((group) => buckets[group].length > 0)
    .map((group) => ({ group, items: buckets[group] }));
}
