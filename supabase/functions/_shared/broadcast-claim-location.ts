/**
 * Deliver a private claim-location broadcast AFTER the Edge Function has
 * already authorized the seeker via can_send_claim_location.
 *
 * Do NOT use the Realtime HTTP Broadcast endpoint. That API returns HTTP
 * 202 even when realtime.messages INSERT RLS silently drops the message
 * (write=false). The publisher then stays on "Waiting for driver location".
 *
 * `realtime.send` is a SECURITY DEFINER database function that fans out to
 * private channel subscribers. Authorization is the Edge Function's job.
 */
export async function broadcastPrivateClaimLocation(input: {
  supabaseUrl: string;
  serviceKey: string;
  topic: string;
  event: string;
  payload: Record<string, unknown>;
}): Promise<{ ok: true } | { ok: false; status: number; detail: string }> {
  const origin = input.supabaseUrl.replace(/\/$/, "");
  const response = await fetch(`${origin}/rest/v1/rpc/send`, {
    method: "POST",
    headers: {
      apikey: input.serviceKey,
      Authorization: `Bearer ${input.serviceKey}`,
      "Content-Type": "application/json",
      "Content-Profile": "realtime",
      "Accept-Profile": "realtime",
    },
    body: JSON.stringify({
      payload: input.payload,
      event: input.event,
      topic: input.topic,
      private: true,
    }),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 400);
    return { ok: false, status: response.status, detail };
  }
  return { ok: true };
}
