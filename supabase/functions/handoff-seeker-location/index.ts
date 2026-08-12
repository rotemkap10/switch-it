/**
 * Authenticated seeker → private Phase 9B Broadcast bridge.
 *
 * Native GPS cannot rely on the WebView. This function:
 * 1. Validates the caller's JWT
 * 2. Checks can_send_claim_location (seeker + active claimed handoff)
 * 3. Broadcasts seeker-location / seeker-location-status on
 *    claim-location:<claimId>
 *
 * Service-role is used only to publish after authorization.
 * No location history is stored.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CLAIM_LOCATION_TOPIC_PREFIX = "claim-location:";
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

  return {
    latitude,
    longitude,
    accuracyMeters,
    headingDegrees: headingDegrees == null ? null : headingDegrees,
    sequence,
    sentAt,
  };
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

  const topic = `${CLAIM_LOCATION_TOPIC_PREFIX}${claimId}`;
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser(
    jwt,
  );
  if (userError || !userData.user) {
    return json({ error: "unauthorized" }, 401);
  }

  const { data: allowed, error: rpcError } = await userClient.rpc(
    "can_send_claim_location",
    { p_topic: topic },
  );
  if (rpcError) {
    return json({ error: "unauthorized" }, 403);
  }
  if (allowed !== true) {
    return json({ error: "unauthorized" }, 403);
  }

  const broadcastResponse = await fetch(
    `${supabaseUrl.replace(/\/$/, "")}/realtime/v1/api/broadcast`,
    {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            topic,
            event,
            payload,
            private: true,
          },
        ],
      }),
    },
  );

  if (!broadcastResponse.ok) {
    return json({ error: "broadcast_failed" }, 502);
  }

  return json({ ok: true });
});
