import { describe, expect, it } from "vitest";

import {
  buildHistoryItems,
  historyEventAt,
  type HistoryClaimRow,
  type HistoryCreditRow,
} from "@/lib/history/load-history";
import { HISTORY_ADDRESS_FALLBACK } from "@/lib/history/format";

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
