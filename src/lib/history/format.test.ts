import { describe, expect, it } from "vitest";

import {
  formatHistoryWhen,
  groupHistoryItems,
  historyCreditLabel,
  historyDayGroup,
  historyRoleLabel,
  historySectionHeading,
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

  it("groups Today / Yesterday / calendar dates using local days", () => {
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
    expect(groups.map((g) => g.key)).toEqual(["today", "yesterday", "2026-08-01"]);
    expect(groups[0].label).toBe("Today");
    expect(groups[1].label).toBe("Yesterday");
    expect(groups[2].label).not.toBe("Today");
    expect(groups[2].label).not.toBe("Yesterday");
    expect(groups[2].label.length).toBeGreaterThan(0);
    expect(formatHistoryWhen(items[0].atIso, now)).toMatch(/^Today · /);
  });

  it("keeps a single section when later pages continue the same calendar day", () => {
    const now = Date.parse("2026-08-18T12:00:00");
    const items: HistoryItem[] = [
      {
        id: "page1",
        role: "publisher",
        status: "completed",
        address: "First St",
        atIso: new Date(2026, 7, 15, 18, 0).toISOString(),
        creditDelta: 1,
      },
      {
        id: "page2",
        role: "seeker",
        status: "cancelled",
        address: "Second St",
        atIso: new Date(2026, 7, 15, 9, 0).toISOString(),
        creditDelta: null,
      },
    ];

    const groups = groupHistoryItems(items, now);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("2026-08-15");
    expect(groups[0].items.map((item) => item.id)).toEqual(["page1", "page2"]);
  });

  it("includes the year on older-year section headings", () => {
    const heading = historySectionHeading(
      new Date(2025, 7, 15, 10, 0).toISOString(),
      Date.parse("2026-08-18T12:00:00"),
    );
    expect(heading.key).toBe("2025-08-15");
    expect(heading.label).toMatch(/2025/);
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
