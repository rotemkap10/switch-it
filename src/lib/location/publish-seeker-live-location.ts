import {
  SEEKER_LOCATION_EVENT,
  SEEKER_LOCATION_STATUS_EVENT,
} from "@/lib/location/constants";
import { handoffSeekerLocationEdgeFunctionUrl } from "@/lib/location/handoff-native-broadcast";
import { logHandoffLive } from "@/lib/location/log-handoff-live";
import type {
  SeekerLocationPayload,
  SeekerLocationStatusPayload,
} from "@/lib/location/payload";

export type SeekerLiveLocationEdgeEvent =
  | typeof SEEKER_LOCATION_EVENT
  | typeof SEEKER_LOCATION_STATUS_EVENT;

export type PublishSeekerLiveLocationResult =
  | { ok: true; accepted: true }
  | { ok: true; accepted: false; reason: "stale_sequence" }
  | {
      ok: false;
      reason:
        | "missing_config"
        | "unauthorized"
        | "rate_limited"
        | "rejected"
        | "network";
      httpStatus?: number;
    };

type PublishInput = {
  claimId: string;
  event: SeekerLiveLocationEdgeEvent;
  payload: SeekerLocationPayload | SeekerLocationStatusPayload;
  accessToken: string;
};

function getEdgePublishConfig():
  | { url: string; publishableKey: string }
  | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) {
    return null;
  }
  return {
    url: handoffSeekerLocationEdgeFunctionUrl(supabaseUrl),
    publishableKey,
  };
}

/**
 * Web seeker transport: same Edge Function path as native GPS posts.
 * Authorizes with the seeker JWT, upserts the latest DB snapshot (locations),
 * and fans out via service-role realtime.send (reliable private Broadcast).
 */
export async function publishSeekerLiveLocationViaEdge(
  input: PublishInput,
): Promise<PublishSeekerLiveLocationResult> {
  const config = getEdgePublishConfig();
  if (!config) {
    logHandoffLive("edge publish skipped", {
      claimId: input.claimId,
      reason: "missing_config",
    });
    return { ok: false, reason: "missing_config" };
  }

  try {
    const response = await fetch(config.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        apikey: config.publishableKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        claimId: input.claimId,
        event: input.event,
        payload: input.payload,
      }),
    });

    if (response.status === 401 || response.status === 403) {
      logHandoffLive("edge publish rejected", {
        claimId: input.claimId,
        event: input.event,
        httpStatus: response.status,
        reason: "unauthorized",
      });
      return { ok: false, reason: "unauthorized", httpStatus: response.status };
    }

    if (response.status === 429) {
      logHandoffLive("edge publish rate limited", {
        claimId: input.claimId,
        event: input.event,
        httpStatus: response.status,
      });
      return { ok: false, reason: "rate_limited", httpStatus: response.status };
    }

    let body: Record<string, unknown> | null = null;
    try {
      body = (await response.json()) as Record<string, unknown>;
    } catch {
      body = null;
    }

    if (!response.ok) {
      logHandoffLive("edge publish failed", {
        claimId: input.claimId,
        event: input.event,
        httpStatus: response.status,
        error: typeof body?.error === "string" ? body.error : null,
      });
      return {
        ok: false,
        reason: "rejected",
        httpStatus: response.status,
      };
    }

    if (body?.accepted === false && body?.reason === "stale_sequence") {
      return { ok: true, accepted: false, reason: "stale_sequence" };
    }

    logHandoffLive("edge publish succeeded", {
      claimId: input.claimId,
      event: input.event,
      sequence:
        "sequence" in input.payload ? input.payload.sequence : undefined,
      httpStatus: response.status,
    });
    return { ok: true, accepted: true };
  } catch {
    logHandoffLive("edge publish network error", {
      claimId: input.claimId,
      event: input.event,
    });
    return { ok: false, reason: "network" };
  }
}
