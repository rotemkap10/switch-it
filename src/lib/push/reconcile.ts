import { createClient } from "@/lib/supabase/client";
import {
  isTerminalHandoffPushType,
  type HandoffPushType,
} from "@/lib/push/types";
import { logPush } from "@/lib/push/log-push";
import type { HandoffPushPayload } from "@/lib/push/payload";

export function handoffPathForPush(input: {
  type: HandoffPushType;
  recipientRole: "seeker" | "publisher";
  claimIsActive: boolean;
}): string {
  if (input.recipientRole === "publisher") {
    return "/spots/new";
  }
  return "/map";
}

/**
 * Open Switch It and reconcile CURRENT backend state.
 * Do not trust the notification as the live claim status.
 */
export async function reconcileHandoffFromPush(
  payload: HandoffPushPayload,
  navigate: (path: string) => void,
): Promise<void> {
  logPush("push action performed", { type: payload.type, claimId: payload.claimId });

  const client = createClient();
  const { data, error } = await client
    .from("claims")
    .select("id, status")
    .eq("id", payload.claimId)
    .maybeSingle();

  const claimIsActive = !error && data?.status === "active";
  const terminalHint = isTerminalHandoffPushType(payload.type);

  const path = handoffPathForPush({
    type: payload.type,
    recipientRole: payload.recipientRole,
    claimIsActive: claimIsActive && !terminalHint ? true : Boolean(claimIsActive),
  });

  navigate(path);
}
