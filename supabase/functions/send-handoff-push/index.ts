/**
 * Drain/send native handoff push from the outbox.
 * Invoked by pg_net AFTER INSERT, Database Webhook, or minute drain.
 * Never blocks claim/cancel/complete RPCs.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { HANDOFF_PUSH_COPY } from "../_shared/handoff-push-copy.ts";
import { sendPushToDevice } from "../_shared/push-providers.ts";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type JsonRecord = Record<string, unknown>;

function json(body: JsonRecord, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function authorized(req: Request): boolean {
  const header = req.headers.get("Authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return false;
  }
  const secret = Deno.env.get("HANDOFF_PUSH_SECRET") ?? "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return (secret.length > 0 && token === secret) || (service.length > 0 && token === service);
}

function log(message: string, detail?: JsonRecord) {
  if (detail) {
    console.log(`[switch-it:push] ${message}`, detail);
    return;
  }
  console.log(`[switch-it:push] ${message}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }
  if (!authorized(req)) {
    return json({ error: "unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "misconfigured" }, 500);
  }

  let body: JsonRecord = {};
  try {
    body = (await req.json()) as JsonRecord;
  } catch {
    body = {};
  }

  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const eventId =
    typeof body.event_id === "string"
      ? body.event_id
      : typeof (body.record as JsonRecord | undefined)?.id === "string"
        ? ((body.record as JsonRecord).id as string)
        : null;

  const ids: string[] = [];
  if (eventId) {
    ids.push(eventId);
  } else if (body.drain === true) {
    const { data } = await service
      .from("handoff_notification_events")
      .select("id")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(25);
    for (const row of data ?? []) {
      if (row && typeof row.id === "string") {
        ids.push(row.id);
      }
    }
  }

  let sent = 0;
  let failed = 0;
  for (const id of ids) {
    const result = await processEvent(service, id);
    if (result === "sent") {
      sent += 1;
    } else if (result === "failed") {
      failed += 1;
    }
  }

  return json({ ok: true, processed: ids.length, sent, failed });
});

async function processEvent(
  service: ReturnType<typeof createClient>,
  eventId: string,
): Promise<"sent" | "failed" | "skipped"> {
  const { data: event, error } = await service
    .from("handoff_notification_events")
    .update({ status: "sending" })
    .eq("id", eventId)
    .eq("status", "pending")
    .select(
      "id, claim_id, spot_id, recipient_user_id, recipient_role, type, payload",
    )
    .maybeSingle();

  if (error || !event) {
    return "skipped";
  }

  const copy = HANDOFF_PUSH_COPY[event.type as string];
  if (!copy) {
    await service
      .from("handoff_notification_events")
      .update({ status: "skipped", error: "unknown_type" })
      .eq("id", eventId);
    return "skipped";
  }

  const data = {
    type: String(event.type),
    claimId: String(event.claim_id),
    spotId: event.spot_id ? String(event.spot_id) : "",
    recipientRole: String(event.recipient_role),
  };

  const { data: devices } = await service
    .from("push_devices")
    .select("id, platform, push_token")
    .eq("user_id", event.recipient_user_id)
    .eq("enabled", true);

  if (!devices || devices.length === 0) {
    await service
      .from("handoff_notification_events")
      .update({
        status: "skipped",
        error: "no_devices",
        sent_at: new Date().toISOString(),
      })
      .eq("id", eventId);
    return "skipped";
  }

  let anyOk = false;
  let lastError = "";
  for (const device of devices) {
    if (
      (device.platform !== "ios" && device.platform !== "android") ||
      typeof device.push_token !== "string"
    ) {
      continue;
    }
    const provider = device.platform === "ios" ? "apns" : "fcm";
    log("push send attempted", {
      provider,
      eventId,
      type: event.type,
      claimId: event.claim_id,
    });
    const result = await sendPushToDevice({
      platform: device.platform,
      token: device.push_token,
      message: { title: copy.title, body: copy.body, data },
    });
    if (result.ok) {
      anyOk = true;
      log("push send succeeded", { provider, eventId });
    } else {
      lastError = `${provider}:${result.status}:${result.detail}`;
      log("push send failed", {
        provider,
        eventId,
        status: result.status,
        detail: result.detail,
      });
      if (result.invalidToken && typeof device.id === "string") {
        log("invalid token disabled", { deviceId: device.id, provider });
        await service
          .from("push_devices")
          .update({
            enabled: false,
            last_error: result.detail.slice(0, 200),
            updated_at: new Date().toISOString(),
          })
          .eq("id", device.id);
      }
    }
  }

  await service
    .from("handoff_notification_events")
    .update({
      status: anyOk ? "sent" : "failed",
      error: anyOk ? null : lastError.slice(0, 400),
      sent_at: new Date().toISOString(),
    })
    .eq("id", eventId);

  return anyOk ? "sent" : "failed";
}
