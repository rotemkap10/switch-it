/**
 * Authenticated seeker → private Phase 9B Broadcast bridge.
 *
 * Native GPS cannot rely on the WebView. This function:
 * 1. Validates the caller's JWT
 * 2. Checks can_send_claim_location (seeker + active claimed handoff)
 * 3. Broadcasts seeker-location / seeker-location-status on
 *    claim-location:<claimId>
 *
 * After can_send_claim_location succeeds, deliver via realtime.send
 * (SECURITY DEFINER). The Realtime HTTP Broadcast endpoint returns 202 even when
 * private-channel RLS silently drops the message, so the publisher never
 * receives live location.
 * Latest snapshot (one row per claim) is upserted before Broadcast for recovery.
 * No location history trail is stored.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { broadcastPrivateClaimLocation } from "../_shared/broadcast-claim-location.ts";
import { getClaimLocationTopic } from "../_shared/claim-location-topic.ts";
import { DRIVER_NEARBY_PUSH_METERS } from "../_shared/handoff-push-copy.ts";
import { haversineDistanceMeters } from "../_shared/haversine.ts";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  /** Required for browser POST preflight (Safari/Chrome). Native HTTP clients ignore CORS. */
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SEEKER_LOCATION_EVENT = "seeker-location";
const SEEKER_LOCATION_STATUS_EVENT = "seeker-location-status";
const LIVE_LOCATION_MAX_ACCURACY_M = 150;
const LIVE_LOCATION_SENT_AT_FUTURE_SKEW_MS = 30_000;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

type JsonRecord = Record<string, unknown>;

function json(body: JsonRecord, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function normalizeClaimId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return UUID_RE.test(normalized) ? normalized : null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isSafePositiveInt(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0 &&
    value <= Number.MAX_SAFE_INTEGER
  );
}

function parseLocationPayload(
  raw: JsonRecord,
  nowMs: number,
): JsonRecord | null {
  const latitude = raw.latitude;
  const longitude = raw.longitude;
  const accuracyMeters = raw.accuracyMeters;
  const headingDegrees = raw.headingDegrees;
  const sequence = raw.sequence;
  const sentAt = raw.sentAt;

  if (!isFiniteNumber(latitude) || latitude < -90 || latitude > 90) {
    return null;
  }
  if (!isFiniteNumber(longitude) || longitude < -180 || longitude > 180) {
    return null;
  }
  if (
    !isFiniteNumber(accuracyMeters) ||
    accuracyMeters <= 0 ||
    accuracyMeters > LIVE_LOCATION_MAX_ACCURACY_M
  ) {
    return null;
  }
  if (
    headingDegrees !== null &&
    headingDegrees !== undefined &&
    (!isFiniteNumber(headingDegrees) ||
      headingDegrees < 0 ||
      headingDegrees > 360)
  ) {
    return null;
  }
  if (!isSafePositiveInt(sequence) || !isFiniteNumber(sentAt) || sentAt <= 0) {
    return null;
  }
  if (sentAt > nowMs + LIVE_LOCATION_SENT_AT_FUTURE_SKEW_MS) {
    return null;
  }

  const parsed: JsonRecord = {
    latitude,
    longitude,
    accuracyMeters,
    sequence,
    sentAt,
  };
  if (headingDegrees != null) {
    parsed.headingDegrees = headingDegrees;
  }
  return parsed;
}

function parseStatusPayload(
  raw: JsonRecord,
  nowMs: number,
): JsonRecord | null {
  const status = raw.status;
  const sequence = raw.sequence;
  const sentAt = raw.sentAt;
  if (status !== "paused" && status !== "stopped") {
    return null;
  }
  if (!isSafePositiveInt(sequence) || !isFiniteNumber(sentAt) || sentAt <= 0) {
    return null;
  }
  if (sentAt > nowMs + LIVE_LOCATION_SENT_AT_FUTURE_SKEW_MS) {
    return null;
  }
  return { status, sequence, sentAt };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) {
    return json({ error: "unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ error: "misconfigured" }, 500);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_body" }, 400);
  }

  if (!body || typeof body !== "object") {
    return json({ error: "invalid_body" }, 400);
  }

  const raw = body as JsonRecord;
  const claimId = normalizeClaimId(raw.claimId);
  const event = raw.event;
  const payloadRaw = raw.payload;
  if (
    !claimId ||
    (event !== SEEKER_LOCATION_EVENT &&
      event !== SEEKER_LOCATION_STATUS_EVENT) ||
    !payloadRaw ||
    typeof payloadRaw !== "object"
  ) {
    return json({ error: "invalid_body" }, 400);
  }

  const nowMs = Date.now();
  const payload =
    event === SEEKER_LOCATION_EVENT
      ? parseLocationPayload(payloadRaw as JsonRecord, nowMs)
      : parseStatusPayload(payloadRaw as JsonRecord, nowMs);
  if (!payload) {
    return json({ error: "invalid_body" }, 400);
  }

  const topic = getClaimLocationTopic(claimId);
  if (!topic) {
    return json({ error: "invalid_body" }, 400);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser(
    jwt,
  );
  if (userError || !userData.user) {
    console.warn("[switch-it:handoff-live] unauthorized jwt", { claimId });
    return json({ error: "unauthorized" }, 401);
  }

  console.log("[switch-it:handoff-live] location received", {
    claimId,
    event,
    topic,
    seekerUserId: userData.user.id,
    lat: (payload as { latitude?: number }).latitude ?? null,
    lng: (payload as { longitude?: number }).longitude ?? null,
    sequence: (payload as { sequence?: number }).sequence ?? null,
    accuracyMeters: (payload as { accuracyMeters?: number }).accuracyMeters ?? null,
  });

  const { data: allowed, error: rpcError } = await userClient.rpc(
    "can_send_claim_location",
    { p_topic: topic },
  );
  if (rpcError) {
    console.warn("[switch-it:handoff-live] claim authorize rpc failed", {
      claimId,
      topic,
    });
    return json({ error: "unauthorized" }, 403);
  }
  if (allowed !== true) {
    console.warn("[switch-it:handoff-live] claim not authorized", {
      claimId,
      topic,
      seekerUserId: userData.user.id,
    });
    return json({ error: "unauthorized" }, 403);
  }

  console.log("[switch-it:handoff-live] claim authorized", {
    claimId,
    topic,
    seekerUserId: userData.user.id,
  });

  let nearbyEnqueue: {
    serviceClient: ReturnType<typeof createClient>;
    claimId: string;
    latitude: unknown;
    longitude: unknown;
  } | null = null;
  let shouldBroadcast = false;

  const serviceClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (event === SEEKER_LOCATION_EVENT) {
    const locationPayload = payload as JsonRecord;

    console.log("[switch-it:handoff-live] snapshot upsert attempted", {
      claimId,
      sequence: locationPayload.sequence ?? null,
    });

    const { data: upsertStatus, error: upsertError } = await serviceClient.rpc(
      "upsert_claim_live_location",
      {
        p_claim_id: claimId,
        p_latitude: locationPayload.latitude,
        p_longitude: locationPayload.longitude,
        p_accuracy_meters: locationPayload.accuracyMeters,
        p_heading_degrees: locationPayload.headingDegrees ?? null,
        p_sequence: locationPayload.sequence,
        p_location_timestamp: new Date(
          locationPayload.sentAt as number,
        ).toISOString(),
      },
    );

    if (upsertError) {
      console.warn("[switch-it:handoff-live] snapshot upsert failed", {
        claimId,
        detail: upsertError.message,
      });
      return json({ error: "snapshot_failed" }, 502);
    }

    if (upsertStatus === "rate_limited") {
      console.warn("[switch-it:handoff-live] location rate limited", {
        claimId,
        sequence: locationPayload.sequence ?? null,
      });
      return json({ error: "rate_limited" }, 429);
    }

    if (upsertStatus === "stale_sequence") {
      console.log("[switch-it:handoff-live] snapshot upsert skipped stale", {
        claimId,
        sequence: locationPayload.sequence ?? null,
      });
      return json({ ok: true, accepted: false, reason: "stale_sequence" });
    }

    if (upsertStatus !== "accepted") {
      console.warn("[switch-it:handoff-live] snapshot upsert unexpected status", {
        claimId,
        status: upsertStatus,
      });
      return json({ error: "snapshot_failed" }, 502);
    }

    console.log("[switch-it:handoff-live] snapshot upsert accepted", {
      claimId,
      sequence: locationPayload.sequence ?? null,
    });

    shouldBroadcast = true;
    nearbyEnqueue = {
      serviceClient,
      claimId,
      latitude: locationPayload.latitude,
      longitude: locationPayload.longitude,
    };
  } else {
    const { data: statusAccept, error: statusError } = await serviceClient.rpc(
      "try_accept_claim_location_status",
      { p_claim_id: claimId },
    );

    if (statusError) {
      console.warn("[switch-it:handoff-live] status rate-limit rpc failed", {
        claimId,
        detail: statusError.message,
      });
      return json({ error: "snapshot_failed" }, 502);
    }

    if (statusAccept === "rate_limited") {
      console.warn("[switch-it:handoff-live] status rate limited", { claimId });
      return json({ error: "rate_limited" }, 429);
    }

    if (statusAccept !== "accepted") {
      console.warn("[switch-it:handoff-live] status accept unexpected status", {
        claimId,
        status: statusAccept,
      });
      return json({ error: "snapshot_failed" }, 502);
    }

    shouldBroadcast = true;
  }

  if (shouldBroadcast) {
    console.log("[switch-it:handoff-live] broadcast attempted", {
      claimId,
      topic,
      event,
      via: "realtime.send",
      rpc: "public.broadcast_claim_location",
    });
    const broadcastResult = await broadcastPrivateClaimLocation({
      supabaseUrl,
      serviceKey,
      topic,
      event,
      payload,
    });

    if (!broadcastResult.ok) {
      console.warn("[switch-it:handoff-live] broadcast failed", {
        claimId,
        topic,
        event,
        status: broadcastResult.status,
        detail: broadcastResult.detail,
        via: "realtime.send",
        rpc: "public.broadcast_claim_location",
      });
      return json({ error: "broadcast_failed" }, 502);
    }

    console.log("[switch-it:handoff-live] broadcast succeeded", {
      claimId,
      topic,
      event,
      via: "realtime.send",
      rpc: "public.broadcast_claim_location",
      httpStatus: broadcastResult.status,
    });

    if (nearbyEnqueue) {
      await enqueueDriverNearbyIfClose(nearbyEnqueue);
    }

    return json({ ok: true, broadcastStatus: broadcastResult.status });
  }

  return json({ error: "internal" }, 500);
});

async function enqueueDriverNearbyIfClose(input: {
  serviceClient: ReturnType<typeof createClient>;
  claimId: string;
  latitude: unknown;
  longitude: unknown;
}): Promise<void> {
  try {
    const { data: claimRow } = await input.serviceClient
      .from("claims")
      .select("spot_id, parking_spots!inner(owner_id, latitude, longitude)")
      .eq("id", input.claimId)
      .eq("status", "active")
      .maybeSingle();
    const spot = Array.isArray(claimRow?.parking_spots)
      ? claimRow?.parking_spots[0]
      : claimRow?.parking_spots;
    const ownerId =
      spot && typeof (spot as { owner_id?: unknown }).owner_id === "string"
        ? (spot as { owner_id: string }).owner_id
        : null;
    const spotLat = (spot as { latitude?: number } | null)?.latitude;
    const spotLng = (spot as { longitude?: number } | null)?.longitude;
    const seekerLat = input.latitude;
    const seekerLng = input.longitude;
    if (
      ownerId &&
      typeof claimRow?.spot_id === "string" &&
      typeof spotLat === "number" &&
      typeof spotLng === "number" &&
      typeof seekerLat === "number" &&
      typeof seekerLng === "number"
    ) {
      const meters = haversineDistanceMeters(
        { latitude: seekerLat, longitude: seekerLng },
        { latitude: spotLat, longitude: spotLng },
      );
      if (meters <= DRIVER_NEARBY_PUSH_METERS) {
        await input.serviceClient.rpc("enqueue_handoff_notification", {
          p_claim_id: input.claimId,
          p_spot_id: claimRow.spot_id,
          p_recipient_user_id: ownerId,
          p_recipient_role: "publisher",
          p_type: "driver_nearby",
          p_payload: {},
        });
      }
    }
  } catch (nearbyError) {
    console.warn("[switch-it:push] driver_nearby enqueue failed", {
      claimId: input.claimId,
      detail: nearbyError instanceof Error ? nearbyError.message : "unknown",
    });
  }
}
