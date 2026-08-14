import {
  LIVE_LOCATION_MAX_ACCURACY_M,
  SEEKER_LOCATION_EVENT,
  SEEKER_LOCATION_STATUS_EVENT,
} from "@/lib/location/constants";
import { getClaimLocationTopic } from "@/lib/location/topic";
import {
  parseSeekerLocationPayload,
  parseSeekerLocationStatusPayload,
} from "@/lib/location/payload";

export type HandoffNativeBroadcastBody = {
  claimId: string;
  event: typeof SEEKER_LOCATION_EVENT | typeof SEEKER_LOCATION_STATUS_EVENT;
  payload: Record<string, unknown>;
};

export type HandoffNativeBroadcastDecision =
  | { ok: true; topic: string; event: string; payload: Record<string, unknown> }
  | {
      ok: false;
      status: 400 | 401 | 403;
      error: "invalid_body" | "invalid_claim" | "unauthorized" | "expired";
    };

export function parseHandoffNativeBroadcastBody(
  value: unknown,
): HandoffNativeBroadcastBody | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const raw = value as Record<string, unknown>;
  if (typeof raw.claimId !== "string") {
    return null;
  }
  if (
    raw.event !== SEEKER_LOCATION_EVENT &&
    raw.event !== SEEKER_LOCATION_STATUS_EVENT
  ) {
    return null;
  }
  if (!raw.payload || typeof raw.payload !== "object") {
    return null;
  }
  return {
    claimId: raw.claimId,
    event: raw.event,
    payload: raw.payload as Record<string, unknown>,
  };
}

/**
 * Validate native → Edge Function body before any Broadcast.
 * Authorization (`can_send_claim_location`) is checked separately with the user JWT.
 */
export function decideHandoffNativeBroadcast(
  body: unknown,
  options: { allowed: boolean; nowMs?: number },
): HandoffNativeBroadcastDecision {
  const parsed = parseHandoffNativeBroadcastBody(body);
  if (!parsed) {
    return { ok: false, status: 400, error: "invalid_body" };
  }

  const topic = getClaimLocationTopic(parsed.claimId);
  if (!topic) {
    return { ok: false, status: 400, error: "invalid_claim" };
  }

  if (!options.allowed) {
    return { ok: false, status: 403, error: "unauthorized" };
  }

  const nowMs = options.nowMs ?? Date.now();
  if (parsed.event === SEEKER_LOCATION_EVENT) {
    const payload = parseSeekerLocationPayload(parsed.payload, nowMs);
    if (!payload) {
      return { ok: false, status: 400, error: "invalid_body" };
    }
    if (payload.accuracyMeters > LIVE_LOCATION_MAX_ACCURACY_M) {
      return { ok: false, status: 400, error: "invalid_body" };
    }
    return {
      ok: true,
      topic,
      event: SEEKER_LOCATION_EVENT,
      payload: { ...payload },
    };
  }

  const statusPayload = parseSeekerLocationStatusPayload(parsed.payload, nowMs);
  if (!statusPayload) {
    return { ok: false, status: 400, error: "invalid_body" };
  }
  return {
    ok: true,
    topic,
    event: SEEKER_LOCATION_STATUS_EVENT,
    payload: { ...statusPayload },
  };
}

export function handoffSeekerLocationEdgeFunctionUrl(
  supabaseUrl: string,
): string {
  const origin = supabaseUrl.replace(/\/$/, "");
  return `${origin}/functions/v1/handoff-seeker-location`;
}

export function realtimeBroadcastHttpUrl(supabaseUrl: string): string {
  const origin = supabaseUrl.replace(/\/$/, "");
  return `${origin}/realtime/v1/api/broadcast`;
}
