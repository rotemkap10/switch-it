import { describe, expect, it } from "vitest";

import {
  formatHistoryWhen,
  groupHistoryItems,
  historyCreditLabel,
  historyDayGroup,
  historyRoleLabel,
  historyStatusLabel,
  type HistoryItem,
} from "@/lib/history/format";

describe("history formatting", () => {
  it("uses friendly role and status labels", () => {
    expect(historyRoleLabel("publisher")).toBe("You shared a spot");
    expect(historyRoleLabel("seeker")).toBe("You found a spot");
    expect(historyStatusLabel("completed")).toBe("Completed");
    expect(historyStatusLabel("cancelled")).toBe("Cancelled");
    expect(historyStatusLabel("expired")).toBe("Expired");
  });

  it("formats credit effects from ledger deltas only", () => {
    expect(historyCreditLabel("completed", 1)).toBe("+1 credit");
    expect(historyCreditLabel("completed", -1)).toBe("-1 credit");
    expect(historyCreditLabel("completed", null)).toBe("No credit change");
    expect(historyCreditLabel("cancelled", null)).toBe("No credit change");
    expect(historyCreditLabel("expired", 1)).toBe("No credit change");
  });

  it("groups Today / Yesterday / Earlier using local calendar days", () => {
    const now = Date.parse("2026-08-07T12:00:00");
    const items: HistoryItem[] = [
      {
        id: "1",
        role: "publisher",
        status: "completed",
        address: "Dizengoff St",
        atIso: new Date(2026, 7, 7, 11, 32).toISOString(),
        creditDelta: 1,
      },
      {
        id: "2",
        role: "seeker",
        status: "cancelled",
        address: "Ibn Gabirol St",
        atIso: new Date(2026, 7, 6, 15, 10).toISOString(),
        creditDelta: null,
      },
      {
        id: "3",
        role: "seeker",
        status: "expired",
        address: null,
        atIso: new Date(2026, 7, 1, 10, 0).toISOString(),
        creditDelta: null,
      },
    ];

    const groups = groupHistoryItems(items, now);
    expect(groups.map((g) => g.group)).toEqual([
      "today",
      "yesterday",
      "earlier",
    ]);
    expect(formatHistoryWhen(items[0].atIso, now)).toMatch(/^Today · /);
  });

  it("keeps late-night local times on Today across the midnight boundary", () => {
    // 00:30 local on Aug 7 — still "today"; 23:50 local on Aug 6 — yesterday.
    const justAfterMidnight = new Date(2026, 7, 7, 0, 30).getTime();
    expect(
      historyDayGroup(new Date(2026, 7, 7, 0, 5).toISOString(), justAfterMidnight),
    ).toBe("today");
    expect(
      historyDayGroup(new Date(2026, 7, 6, 23, 50).toISOString(), justAfterMidnight),
    ).toBe("yesterday");
  });
});
