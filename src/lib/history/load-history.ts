import type { SupabaseClient } from "@supabase/supabase-js";

import {
  HISTORY_ADDRESS_FALLBACK,
  HISTORY_PAGE_SIZE,
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

export type HandoffHistoryRpcRow = {
  claim_id: string;
  role: string;
  status: string;
  address: string | null;
  event_at: string;
  credit_amount: number | null;
};

export type HistoryCursor = {
  beforeAt: string;
  beforeId: string;
};

export type LoadHistoryPageResult =
  | {
      ok: true;
      items: HistoryItem[];
      hasMore: boolean;
      nextCursor: HistoryCursor | null;
    }
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

function asRole(role: string): HistoryRole | null {
  if (role === "publisher" || role === "seeker") {
    return role;
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

function resolveAddress(address: string | null | undefined): string {
  const trimmed = typeof address === "string" ? address.trim() : "";
  return trimmed || HISTORY_ADDRESS_FALLBACK;
}

function compareHistoryItems(a: HistoryItem, b: HistoryItem): number {
  const dt = new Date(b.atIso).getTime() - new Date(a.atIso).getTime();
  if (dt !== 0) {
    return dt;
  }
  return b.id.localeCompare(a.id);
}

/**
 * Pure mapper — one History card per claim for the current participant.
 * Credit deltas come only from the user’s own credit_transactions rows.
 */
export function buildHistoryItems(
  claims: HistoryClaimRow[],
  credits: HistoryCreditRow[],
  userId: string,
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
      address: resolveAddress(spot?.address),
      atIso: historyEventAt(raw),
      creditDelta,
    });
  }

  items.sort(compareHistoryItems);
  return items;
}

export function mapHandoffHistoryRpcRows(
  rows: HandoffHistoryRpcRow[],
): HistoryItem[] {
  const seen = new Set<string>();
  const items: HistoryItem[] = [];

  for (const row of rows) {
    if (typeof row.claim_id !== "string" || seen.has(row.claim_id)) {
      continue;
    }

    const role = asRole(row.role);
    const status = asFinalStatus(row.status);
    if (!role || !status) {
      continue;
    }
    if (typeof row.event_at !== "string" || row.event_at.length === 0) {
      continue;
    }

    seen.add(row.claim_id);
    const creditAmount = row.credit_amount;
    const creditDelta =
      status === "completed" &&
      typeof creditAmount === "number" &&
      Number.isFinite(creditAmount)
        ? creditAmount
        : null;

    // Null address means parking_spots RLS would hide the spot (typical for
    // seekers on old terminal handoffs). Never invent a street from the row.
    items.push({
      id: `${role}:${row.claim_id}`,
      role,
      status,
      address: resolveAddress(row.address),
      atIso: row.event_at,
      creditDelta,
    });
  }

  items.sort(compareHistoryItems);
  return items;
}

function cursorFromItems(items: HistoryItem[]): HistoryCursor | null {
  const last = items[items.length - 1];
  if (!last) {
    return null;
  }
  const separator = last.id.indexOf(":");
  const beforeId = separator >= 0 ? last.id.slice(separator + 1) : last.id;
  if (!beforeId) {
    return null;
  }
  return { beforeAt: last.atIso, beforeId };
}

/**
 * Load one newest-first page of the current user's terminal handoffs.
 * Uses get_handoff_history so pagination happens in Postgres, not in memory.
 */
export async function loadHistoryPage(
  supabase: SupabaseClient,
  cursor?: HistoryCursor | null,
  pageSize: number = HISTORY_PAGE_SIZE,
): Promise<LoadHistoryPageResult> {
  const fetchLimit = Math.min(Math.max(pageSize, 1) + 1, 21);

  const { data, error } = await supabase.rpc("get_handoff_history", {
    p_limit: fetchLimit,
    p_before_at: cursor?.beforeAt ?? null,
    p_before_id: cursor?.beforeId ?? null,
  });

  if (error) {
    return { ok: false };
  }

  const rows = Array.isArray(data) ? (data as HandoffHistoryRpcRow[]) : [];
  const mapped = mapHandoffHistoryRpcRows(rows);
  const hasMore = mapped.length > pageSize;
  const items = hasMore ? mapped.slice(0, pageSize) : mapped;

  return {
    ok: true,
    items,
    hasMore,
    nextCursor: hasMore ? cursorFromItems(items) : null,
  };
}

/** First History page (newest 20). */
export async function loadHistoryItems(
  supabase: SupabaseClient,
): Promise<LoadHistoryPageResult> {
  return loadHistoryPage(supabase);
}
