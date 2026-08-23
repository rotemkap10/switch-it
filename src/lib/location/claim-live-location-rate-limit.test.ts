import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const MIN_INTERVAL_MS = 2_000;

type SnapshotRow = {
  sequence: number;
  locationTimestampMs: number;
  updatedAtMs: number;
  latitude: number;
};

type UpsertInput = {
  sequence: number;
  locationTimestampMs: number;
  latitude: number;
  nowMs: number;
};

type UpsertResult = "accepted" | "stale_sequence" | "rate_limited";

/** Mirrors hardened upsert_claim_live_location: strict sequence + wall-clock interval. */
function decideUpsert(
  existing: SnapshotRow | null,
  input: UpsertInput,
): UpsertResult {
  if (!existing) {
    return "accepted";
  }

  if (input.sequence <= existing.sequence) {
    return "stale_sequence";
  }

  if (input.nowMs - existing.updatedAtMs < MIN_INTERVAL_MS) {
    return "rate_limited";
  }

  return "accepted";
}

function applyAccepted(
  existing: SnapshotRow | null,
  input: UpsertInput,
): SnapshotRow {
  return {
    sequence: input.sequence,
    locationTimestampMs: input.locationTimestampMs,
    updatedAtMs: input.nowMs,
    latitude: input.latitude,
  };
}

class AtomicClaimLiveLocationStore {
  private row: SnapshotRow | null = null;
  private lock: Promise<void> = Promise.resolve();

  async upsert(input: UpsertInput): Promise<UpsertResult> {
    return this.withLock(async () => {
      const result = decideUpsert(this.row, input);
      if (result === "accepted") {
        this.row = applyAccepted(this.row, input);
      }
      return result;
    });
  }

  snapshot(): SnapshotRow | null {
    return this.row;
  }

  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    const previous = this.lock;
    let release!: () => void;
    this.lock = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await fn();
    } finally {
      release();
    }
  }
}

describe("claim live location atomic rate limit", () => {
  const root = process.cwd();
  const edge = readFileSync(
    resolve(root, "supabase/functions/handoff-seeker-location/index.ts"),
    "utf8",
  );
  const hardening = readFileSync(
    resolve(
      root,
      "supabase/migrations/20260823120000_claim_live_location_rate_limit_hardening.sql",
    ),
    "utf8",
  );

  it("Edge Function delegates accept/reject to upsert_claim_live_location RPC", () => {
    expect(edge).toContain("upsert_claim_live_location");
    expect(edge).not.toContain("LIVE_LOCATION_MIN_SEND_INTERVAL_MS");
    expect(edge).not.toContain('.from("claim_live_locations")');
  });

  it("rate-limits seeker-location-status before broadcast", () => {
    expect(edge).toContain("try_accept_claim_location_status");
    expect(edge).toContain("status rate limited");
    expect(hardening).toContain("claim_live_status_throttle");
  });

  it("broadcasts only when the database accepted the snapshot", () => {
    expect(edge).toContain('upsertStatus !== "accepted"');
    expect(edge).toContain("shouldBroadcast = true");
    expect(edge).toContain('return json({ error: "rate_limited" }, 429)');
    expect(edge).toContain('reason: "stale_sequence"');
    expect(edge).toContain("if (shouldBroadcast)");
    const broadcastGuard = edge.indexOf("if (shouldBroadcast)");
    const broadcastCall = edge.indexOf("await broadcastPrivateClaimLocation");
    expect(broadcastCall).toBeGreaterThan(broadcastGuard);
  });

  it("accepts the first snapshot immediately", () => {
    expect(decideUpsert(null, sample(1, 0))).toBe("accepted");
  });

  it("accepts a newer sequence after the minimum interval", () => {
    const existing: SnapshotRow = {
      sequence: 1,
      locationTimestampMs: 0,
      updatedAtMs: 0,
      latitude: 32.1,
    };
    expect(
      decideUpsert(existing, sample(2, existing.updatedAtMs + MIN_INTERVAL_MS)),
    ).toBe("accepted");
  });

  it("rejects a newer sequence inside the minimum interval", () => {
    const existing: SnapshotRow = {
      sequence: 10,
      locationTimestampMs: 0,
      updatedAtMs: 1_000,
      latitude: 32.1,
    };
    expect(decideUpsert(existing, sample(11, 2_500))).toBe("rate_limited");
    expect(decideUpsert(existing, sample(99, 2_500))).toBe("rate_limited");
  });

  it("rejects same or lower sequences regardless of client timestamp", () => {
    const existing: SnapshotRow = {
      sequence: 5,
      locationTimestampMs: 5_000,
      updatedAtMs: 10_000,
      latitude: 32.1,
    };
    expect(decideUpsert(existing, sample(4, 20_000))).toBe("stale_sequence");
    expect(decideUpsert(existing, sample(5, 4_000))).toBe("stale_sequence");
    expect(decideUpsert(existing, sample(5, 99_000))).toBe("stale_sequence");
  });

  it("rejects duplicate sequences even after the interval", () => {
    const existing: SnapshotRow = {
      sequence: 3,
      locationTimestampMs: 3_000,
      updatedAtMs: 9_000,
      latitude: 32.1,
    };
    expect(decideUpsert(existing, sample(3, 3_000))).toBe("stale_sequence");
    expect(decideUpsert(existing, sample(3, 12_000))).toBe("stale_sequence");
  });

  it("serializes concurrent increasing sequences so only one passes per interval", async () => {
    const store = new AtomicClaimLiveLocationStore();

    const first = await store.upsert(sample(1, 0));
    expect(first).toBe("accepted");

    const afterInterval = MIN_INTERVAL_MS + 100;
    const [second, third] = await Promise.all([
      store.upsert(sample(2, afterInterval)),
      store.upsert(sample(3, afterInterval)),
    ]);

    const outcomes = [second, third];
    expect(outcomes.filter((value) => value === "accepted")).toHaveLength(1);
    expect(outcomes.filter((value) => value === "rate_limited")).toHaveLength(1);
    expect(store.snapshot()?.sequence).toBeGreaterThan(1);
  });

  it("serializes concurrent first-row inserts so only one is accepted", async () => {
    const store = new AtomicClaimLiveLocationStore();
    const [a, b] = await Promise.all([
      store.upsert(sample(1, 0)),
      store.upsert(sample(2, 0)),
    ]);
    const outcomes = [a, b];
    expect(outcomes.filter((value) => value === "accepted")).toHaveLength(1);
    expect(
      outcomes.filter(
        (value) => value === "rate_limited" || value === "stale_sequence",
      ),
    ).toHaveLength(1);
    expect(store.snapshot()).not.toBeNull();
  });

  it("does not advance stored sequence when rate limited or stale", async () => {
    const store = new AtomicClaimLiveLocationStore();
    await store.upsert(sample(7, 0));

    expect(await store.upsert(sample(6, 5_000))).toBe("stale_sequence");
    expect(await store.upsert(sample(8, 500))).toBe("rate_limited");
    expect(store.snapshot()?.sequence).toBe(7);
  });

  it("hardening migration locks claims and uses clock_timestamp", () => {
    expect(hardening).toContain("from public.claims");
    expect(hardening).toContain("pg_catalog.clock_timestamp()");
    expect(hardening).toContain("if p_sequence <= v_live.sequence then");
  });
});

function sample(sequence: number, nowMs: number): UpsertInput {
  return {
    sequence,
    locationTimestampMs: nowMs,
    latitude: 32.08 + sequence * 0.0001,
    nowMs,
  };
}
