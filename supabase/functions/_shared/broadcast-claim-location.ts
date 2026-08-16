/**
 * Deliver a private claim-location broadcast AFTER the Edge Function has
 * already authorized the seeker via can_send_claim_location.
 *
 * Do NOT use the Realtime HTTP Broadcast endpoint. That API returns HTTP
 * 202 even when realtime.messages INSERT RLS silently drops the message
 * (write=false). The publisher then stays on "Waiting for driver location".
 *
 * Do NOT call the PostgREST realtime-schema send RPC. This project does not
 * expose the realtime schema to PostgREST (PGRST106), so that path fails
 * before realtime.send runs.
 *
 * Use `public.broadcast_claim_location` (SECURITY DEFINER → realtime.send).
 */
export async function broadcastPrivateClaimLocation(input: {
  supabaseUrl: string;
  serviceKey: string;
  topic: string;
  event: string;
  payload: Record<string, unknown>;
}): Promise<
  | { ok: true; status: number }
  | { ok: false; status: number; detail: string }
> {
  const origin = input.supabaseUrl.replace(/\/$/, "");
  const response = await fetch(
    `${origin}/rest/v1/rpc/broadcast_claim_location`,
    {
      method: "POST",
      headers: {
        apikey: input.serviceKey,
        Authorization: `Bearer ${input.serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        p_payload: input.payload,
        p_event: input.event,
        p_topic: input.topic,
      }),
    },
  );

  const detail = (await response.text()).slice(0, 400);
  if (!response.ok) {
    return { ok: false, status: response.status, detail };
  }
  // PostgREST void RPC returns 204 (or 200 empty). Treat both as success;
  // still surface unexpected bodies for diagnostics.
  if (detail && detail !== "null") {
    console.log("[switch-it:handoff-live] realtime.send rpc body", {
      status: response.status,
      detail,
      topic: input.topic,
      event: input.event,
      via: "public.broadcast_claim_location",
    });
  }
  return { ok: true, status: response.status };
}
