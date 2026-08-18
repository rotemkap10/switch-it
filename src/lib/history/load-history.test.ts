import { describe, expect, it, vi } from "vitest";

import {
  buildHistoryItems,
  historyEventAt,
  loadHistoryPage,
  mapHandoffHistoryRpcRows,
  type HistoryClaimRow,
  type HistoryCreditRow,
  type HandoffHistoryRpcRow,
} from "@/lib/history/load-history";
import { HISTORY_ADDRESS_FALLBACK, HISTORY_PAGE_SIZE } from "@/lib/history/format";

const USER_A = "user-a";
const USER_B = "user-b";
const USER_C = "user-c";

function claim(
  overrides: Partial<HistoryClaimRow> & Pick<HistoryClaimRow, "id" | "status">,
): HistoryClaimRow {
  return {
    claimed_at: "2026-08-05T10:00:00.000Z",
    completed_at: null,
    cancelled_at: null,
    expires_at: "2026-08-05T10:30:00.000Z",
    seeker_id: USER_B,
    parking_spots: {
      id: "spot-1",
      address: "Dizengoff St",
      owner_id: USER_A,
    },
    ...overrides,
  };
}

describe("buildHistoryItems", () => {
  it("publisher completed → You shared a spot + +1 credit from ledger", () => {
    const claims = [
      claim({
        id: "c1",
        status: "completed",
        completed_at: "2026-08-05T10:20:00.000Z",
        seeker_id: USER_B,
        parking_spots: {
          id: "s1",
          address: "Dizengoff St",
          owner_id: USER_A,
        },
      }),
    ];
    const credits: HistoryCreditRow[] = [
      { claim_id: "c1", amount: 1, transaction_type: "handoff_credit" },
    ];

    const items = buildHistoryItems(claims, credits, USER_A);
    expect(items).toHaveLength(1);
    expect(items[0].role).toBe("publisher");
    expect(items[0].creditDelta).toBe(1);
  });

  it("seeker completed → You found a spot + −1 credit from ledger", () => {
    const claims = [
      claim({
        id: "c2",
        status: "completed",
        completed_at: "2026-08-05T10:20:00.000Z",
        seeker_id: USER_B,
      }),
    ];
    const credits: HistoryCreditRow[] = [
      { claim_id: "c2", amount: -1, transaction_type: "handoff_debit" },
    ];

    const items = buildHistoryItems(claims, credits, USER_B);
    expect(items).toHaveLength(1);
    expect(items[0].role).toBe("seeker");
    expect(items[0].creditDelta).toBe(-1);
  });

  it("cancelled and expired show no credit change even if ledger is empty", () => {
    const claims = [
      claim({
        id: "c3",
        status: "cancelled",
        cancelled_at: "2026-08-05T10:15:00.000Z",
        seeker_id: USER_B,
      }),
      claim({
        id: "c4",
        status: "expired",
        expires_at: "2026-08-05T10:30:00.000Z",
        seeker_id: USER_B,
      }),
    ];

    const items = buildHistoryItems(claims, [], USER_B);
    expect(items).toHaveLength(2);
    expect(items.every((i) => i.creditDelta === null)).toBe(true);
  });

  it("excludes active (non-terminal) claims", () => {
    const claims = [
      claim({ id: "active", status: "active", seeker_id: USER_B }),
      claim({
        id: "done",
        status: "completed",
        completed_at: "2026-08-05T10:20:00.000Z",
        seeker_id: USER_B,
      }),
    ];
    const items = buildHistoryItems(
      claims,
      [{ claim_id: "done", amount: -1, transaction_type: "handoff_debit" }],
      USER_B,
    );
    expect(items.map((i) => i.id)).toEqual(["seeker:done"]);
  });

  it("unrelated user receives no entry", () => {
    const claims = [
      claim({
        id: "c5",
        status: "completed",
        completed_at: "2026-08-05T10:20:00.000Z",
        seeker_id: USER_B,
        parking_spots: {
          id: "s1",
          address: "Dizengoff St",
          owner_id: USER_A,
        },
      }),
    ];
    expect(buildHistoryItems(claims, [], USER_C)).toEqual([]);
  });

  it("same user as publisher and seeker on different handoffs gets correct role per row", () => {
    const claims = [
      claim({
        id: "as-owner",
        status: "completed",
        completed_at: "2026-08-06T12:00:00.000Z",
        seeker_id: USER_B,
        parking_spots: {
          id: "s-own",
          address: "Owner St",
          owner_id: USER_A,
        },
      }),
      claim({
        id: "as-seeker",
        status: "completed",
        completed_at: "2026-08-06T11:00:00.000Z",
        seeker_id: USER_A,
        parking_spots: {
          id: "s-other",
          address: "Seeker St",
          owner_id: USER_B,
        },
      }),
    ];
    const credits: HistoryCreditRow[] = [
      { claim_id: "as-owner", amount: 1, transaction_type: "handoff_credit" },
      { claim_id: "as-seeker", amount: -1, transaction_type: "handoff_debit" },
    ];

    const items = buildHistoryItems(claims, credits, USER_A);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      id: "publisher:as-owner",
      role: "publisher",
      creditDelta: 1,
    });
    expect(items[1]).toMatchObject({
      id: "seeker:as-seeker",
      role: "seeker",
      creditDelta: -1,
    });
  });

  it("duplicate credit rows do not duplicate cards", () => {
    const claims = [
      claim({
        id: "c6",
        status: "completed",
        completed_at: "2026-08-05T10:20:00.000Z",
        seeker_id: USER_B,
      }),
    ];
    const credits: HistoryCreditRow[] = [
      { claim_id: "c6", amount: -1, transaction_type: "handoff_debit" },
      { claim_id: "c6", amount: -1, transaction_type: "handoff_debit" },
    ];

    const items = buildHistoryItems(claims, credits, USER_B);
    expect(items).toHaveLength(1);
  });

  it("null / missing spot address uses Parking location fallback", () => {
    const claims = [
      claim({
        id: "c7",
        status: "completed",
        completed_at: "2026-08-05T10:20:00.000Z",
        seeker_id: USER_B,
        parking_spots: { id: "s1", address: null, owner_id: USER_A },
      }),
      claim({
        id: "c8",
        status: "completed",
        completed_at: "2026-08-05T09:00:00.000Z",
        seeker_id: USER_B,
        // Nested spot hidden by parking_spots RLS for seekers on terminal spots
        parking_spots: null,
      }),
    ];

    const items = buildHistoryItems(claims, [], USER_B);
    expect(items).toHaveLength(2);
    expect(items.every((i) => i.address === HISTORY_ADDRESS_FALLBACK)).toBe(
      true,
    );
    expect(items.every((i) => i.role === "seeker")).toBe(true);
  });

  it("completed without a matching credit transaction does not invent ±1", () => {
    const claims = [
      claim({
        id: "c9",
        status: "completed",
        completed_at: "2026-08-05T10:20:00.000Z",
        seeker_id: USER_B,
      }),
    ];
    const items = buildHistoryItems(claims, [], USER_B);
    expect(items[0].creditDelta).toBeNull();
  });

  it("orders newest terminal event first", () => {
    const claims = [
      claim({
        id: "older",
        status: "completed",
        completed_at: "2026-08-01T10:00:00.000Z",
        claimed_at: "2026-08-01T09:00:00.000Z",
        seeker_id: USER_B,
      }),
      claim({
        id: "newer",
        status: "cancelled",
        cancelled_at: "2026-08-05T18:00:00.000Z",
        claimed_at: "2026-08-01T08:00:00.000Z",
        seeker_id: USER_B,
      }),
    ];
    const items = buildHistoryItems(claims, [], USER_B);
    expect(items.map((i) => i.id)).toEqual([
      "seeker:newer",
      "seeker:older",
    ]);
  });

  it("does not put claim ids, emails, or handoff codes into display fields", () => {
    const claims = [
      claim({
        id: "uuid-claim-secret",
        status: "completed",
        completed_at: "2026-08-05T10:20:00.000Z",
        seeker_id: USER_B,
        parking_spots: {
          id: "uuid-spot-secret",
          address: "Rothschild Blvd",
          owner_id: USER_A,
        },
      }),
    ];
    const items = buildHistoryItems(
      claims,
      [{ claim_id: "uuid-claim-secret", amount: -1, transaction_type: "handoff_debit" }],
      USER_B,
    );
    const displayBlob = JSON.stringify({
      address: items[0].address,
      role: items[0].role,
      status: items[0].status,
      creditDelta: items[0].creditDelta,
    });
    expect(displayBlob).not.toContain("uuid-claim-secret");
    expect(displayBlob).not.toContain("uuid-spot-secret");
    expect(displayBlob).not.toContain(USER_A);
    expect(displayBlob).not.toContain("@");
  });

  it("does not cap mapped history to a retention window", () => {
    const claims = Array.from({ length: 45 }, (_, index) =>
      claim({
        id: `claim-${String(index).padStart(2, "0")}`,
        status: "completed",
        completed_at: new Date(Date.UTC(2026, 6, 1, 10, index)).toISOString(),
        claimed_at: new Date(Date.UTC(2026, 6, 1, 9, index)).toISOString(),
        seeker_id: USER_B,
      }),
    );

    expect(buildHistoryItems(claims, [], USER_B)).toHaveLength(45);
  });
});

describe("historyEventAt", () => {
  it("prefers completed_at / cancelled_at / expires_at over claimed_at", () => {
    expect(
      historyEventAt({
        status: "completed",
        claimed_at: "2026-08-01T09:00:00.000Z",
        completed_at: "2026-08-01T10:00:00.000Z",
        cancelled_at: null,
        expires_at: "2026-08-01T10:30:00.000Z",
      }),
    ).toBe("2026-08-01T10:00:00.000Z");

    expect(
      historyEventAt({
        status: "cancelled",
        claimed_at: "2026-08-01T09:00:00.000Z",
        completed_at: null,
        cancelled_at: "2026-08-01T09:45:00.000Z",
        expires_at: "2026-08-01T10:30:00.000Z",
      }),
    ).toBe("2026-08-01T09:45:00.000Z");

    expect(
      historyEventAt({
        status: "expired",
        claimed_at: "2026-08-01T09:00:00.000Z",
        completed_at: null,
        cancelled_at: null,
        expires_at: "2026-08-01T10:30:00.000Z",
      }),
    ).toBe("2026-08-01T10:30:00.000Z");
  });
});

describe("mapHandoffHistoryRpcRows", () => {
  it("maps RPC rows and ignores credit on non-completed handoffs", () => {
    const rows: HandoffHistoryRpcRow[] = [
      {
        claim_id: "11111111-1111-4111-8111-111111111111",
        role: "publisher",
        status: "completed",
        address: "Dizengoff St",
        event_at: "2026-08-05T10:20:00.000Z",
        credit_amount: 1,
      },
      {
        claim_id: "22222222-2222-4222-8222-222222222222",
        role: "seeker",
        status: "cancelled",
        address: " ",
        event_at: "2026-08-05T09:00:00.000Z",
        credit_amount: -1,
      },
    ];

    const items = mapHandoffHistoryRpcRows(rows);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      id: "publisher:11111111-1111-4111-8111-111111111111",
      role: "publisher",
      creditDelta: 1,
      address: "Dizengoff St",
    });
    expect(items[1]).toMatchObject({
      role: "seeker",
      status: "cancelled",
      creditDelta: null,
      address: HISTORY_ADDRESS_FALLBACK,
    });
  });

  it("uses the generic fallback when the RPC withholds a seeker's hidden address", () => {
    const items = mapHandoffHistoryRpcRows([
      {
        claim_id: "33333333-3333-4333-8333-333333333333",
        role: "seeker",
        status: "completed",
        address: null,
        event_at: "2026-07-01T10:00:00.000Z",
        credit_amount: -1,
      },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].address).toBe(HISTORY_ADDRESS_FALLBACK);
    expect(JSON.stringify(items[0])).not.toContain("Dizengoff");
    expect(JSON.stringify(items[0])).not.toContain("Rothschild");
    expect(JSON.stringify(items[0])).not.toMatch(/32\.\d+/);
    expect(JSON.stringify(items[0])).not.toMatch(/34\.\d+/);
  });
});

describe("loadHistoryPage", () => {
  it("requests page-size + 1 rows and keeps a keyset cursor", async () => {
    const rows = Array.from({ length: 21 }, (_, index) => ({
      claim_id: `11111111-1111-4111-8111-${String(index).padStart(12, "0")}`,
      role: "seeker",
      status: "completed",
      address: "Dizengoff St",
      event_at: new Date(Date.UTC(2026, 7, 18, 12, 21 - index)).toISOString(),
      credit_amount: -1,
    }));
    const rpc = vi.fn().mockResolvedValue({ data: rows, error: null });

    const result = await loadHistoryPage({ rpc } as never);

    expect(rpc).toHaveBeenCalledWith("get_handoff_history", {
      p_limit: HISTORY_PAGE_SIZE + 1,
      p_before_at: null,
      p_before_id: null,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.items).toHaveLength(HISTORY_PAGE_SIZE);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toEqual({
      beforeAt: rows[19].event_at,
      beforeId: rows[19].claim_id,
    });
  });

  it("passes the previous cursor through to Postgres", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });

    const result = await loadHistoryPage(
      { rpc } as never,
      {
        beforeAt: "2026-08-01T10:00:00.000Z",
        beforeId: "11111111-1111-4111-8111-111111111111",
      },
    );

    expect(rpc).toHaveBeenCalledWith("get_handoff_history", {
      p_limit: HISTORY_PAGE_SIZE + 1,
      p_before_at: "2026-08-01T10:00:00.000Z",
      p_before_id: "11111111-1111-4111-8111-111111111111",
    });
    expect(result).toEqual({
      ok: true,
      items: [],
      hasMore: false,
      nextCursor: null,
    });
  });

  it("fails closed when the RPC errors", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "NOT_AUTHENTICATED" },
    });

    await expect(loadHistoryPage({ rpc } as never)).resolves.toEqual({
      ok: false,
    });
  });
});
