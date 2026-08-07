import type { SupabaseClient } from "@supabase/supabase-js";

import {
  HISTORY_ADDRESS_FALLBACK,
  type HistoryFinalStatus,
  type HistoryItem,
  type HistoryRole,
} from "@/lib/history/format";

export type SpotEmbed = {
  id: string;
  address: string | null;
  owner_id: string;
};

export type HistoryClaimRow = {
  id: string;
  status: string;
  claimed_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
  expires_at: string;
  seeker_id: string;
  parking_spots: SpotEmbed | SpotEmbed[] | null;
};

export type HistoryCreditRow = {
  claim_id: string | null;
  amount: number;
  transaction_type: string;
};

export type LoadHistoryResult =
  | { ok: true; items: HistoryItem[] }
  | { ok: false };

function spotRelation(row: HistoryClaimRow): SpotEmbed | null {
  if (!row.parking_spots) {
    return null;
  }
  return Array.isArray(row.parking_spots)
    ? (row.parking_spots[0] ?? null)
    : row.parking_spots;
}

function asFinalStatus(status: string): HistoryFinalStatus | null {
  if (status === "completed" || status === "cancelled" || status === "expired") {
    return status;
  }
  return null;
}

/** Terminal event time — never invents an expired_at column. */
export function historyEventAt(row: {
  status: string;
  claimed_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
  expires_at: string;
}): string {
  if (row.status === "completed" && row.completed_at) {
    return row.completed_at;
  }
  if (row.status === "cancelled" && row.cancelled_at) {
    return row.cancelled_at;
  }
  if (row.status === "expired") {
    return row.expires_at;
  }
  return row.claimed_at;
}

function resolveRole(
  userId: string,
  seekerId: string,
  spot: SpotEmbed | null,
): HistoryRole | null {
  const isSeeker = seekerId === userId;
  const isPublisher = spot?.owner_id === userId;
  if (isSeeker) {
    return "seeker";
  }
  if (isPublisher) {
    return "publisher";
  }
  return null;
}

function resolveAddress(spot: SpotEmbed | null): string {
  const trimmed =
    typeof spot?.address === "string" ? spot.address.trim() : "";
  return trimmed || HISTORY_ADDRESS_FALLBACK;
}

/**
 * Pure mapper — one History card per claim for the current participant.
 * Credit deltas come only from the user’s own credit_transactions rows.
 */
export function buildHistoryItems(
  claims: HistoryClaimRow[],
  credits: HistoryCreditRow[],
  userId: string,
  limit = 40,
): HistoryItem[] {
  const creditsByClaim = new Map<string, number>();
  for (const row of credits) {
    if (typeof row.claim_id !== "string") {
      continue;
    }
    if (
      row.transaction_type !== "handoff_debit" &&
      row.transaction_type !== "handoff_credit"
    ) {
      continue;
    }
    if (typeof row.amount !== "number" || !Number.isFinite(row.amount)) {
      continue;
    }
    // One debit/credit per claim is enforced in DB; last write wins if noisy.
    creditsByClaim.set(row.claim_id, row.amount);
  }

  const seenClaims = new Set<string>();
  const items: HistoryItem[] = [];

  for (const raw of claims) {
    if (seenClaims.has(raw.id)) {
      continue;
    }

    const status = asFinalStatus(raw.status);
    if (!status) {
      continue;
    }

    const spot = spotRelation(raw);
    const role = resolveRole(userId, raw.seeker_id, spot);
    if (!role) {
      // Unrelated authenticated users must never receive a row.
      continue;
    }

    // Seeker terminal claims remain visible even when parking_spots RLS hides
    // the nested spot (non-available / non-owned). Address falls back.
    seenClaims.add(raw.id);

    const creditFromLedger = creditsByClaim.get(raw.id);
    const creditDelta =
      status === "completed" && typeof creditFromLedger === "number"
        ? creditFromLedger
        : null;

    items.push({
      id: `${role}:${raw.id}`,
      role,
      status,
      address: resolveAddress(spot),
      atIso: historyEventAt(raw),
      creditDelta,
    });
  }

  items.sort(
    (a, b) => new Date(b.atIso).getTime() - new Date(a.atIso).getTime(),
  );

  return items.slice(0, limit);
}

/**
 * Load the current user's terminal handoffs for History.
 * Server-only helper using the cookie SSR Supabase client + existing RLS.
 */
export async function loadHistoryItems(
  supabase: SupabaseClient,
  userId: string,
  limit = 40,
): Promise<LoadHistoryResult> {
  const [claimsResult, creditResult] = await Promise.all([
    supabase
      .from("claims")
      .select(
        `
        id,
        status,
        claimed_at,
        completed_at,
        cancelled_at,
        expires_at,
        seeker_id,
        parking_spots (
          id,
          address,
          owner_id
        )
      `,
      )
      .in("status", ["completed", "cancelled", "expired"])
      .order("claimed_at", { ascending: false })
      .limit(80),
    supabase
      .from("credit_transactions")
      .select("claim_id, amount, transaction_type")
      .eq("user_id", userId)
      .in("transaction_type", ["handoff_debit", "handoff_credit"]),
  ]);

  if (claimsResult.error || creditResult.error) {
    return { ok: false };
  }

  return {
    ok: true,
    items: buildHistoryItems(
      (claimsResult.data ?? []) as HistoryClaimRow[],
      (creditResult.data ?? []) as HistoryCreditRow[],
      userId,
      limit,
    ),
  };
}
