"use server";

import { z } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import { actionErrorFromUnknown } from "@/lib/feedback/action-recovery";
import { GENERIC_APP_ERROR } from "@/lib/feedback/error-map";
import {
  loadHistoryPage,
  type LoadHistoryPageResult,
} from "@/lib/history/load-history";

const loadMoreHistorySchema = z.object({
  beforeAt: z.string().trim().min(1),
  beforeId: z.uuid(),
});

export type LoadMoreHistoryResult =
  | Extract<LoadHistoryPageResult, { ok: true }>
  | { ok: false; error: string };

export async function loadMoreHistory(input: {
  beforeAt: string;
  beforeId: string;
}): Promise<LoadMoreHistoryResult> {
  const parsed = loadMoreHistorySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: GENERIC_APP_ERROR };
  }

  try {
    const { supabase } = await requireUser();
    const result = await loadHistoryPage(supabase, {
      beforeAt: parsed.data.beforeAt,
      beforeId: parsed.data.beforeId,
    });

    if (!result.ok) {
      return {
        ok: false,
        error: "Couldn’t load more handoffs. Please try again.",
      };
    }

    return result;
  } catch (error) {
    const failure = actionErrorFromUnknown(error, GENERIC_APP_ERROR, {
      operation: "get_handoff_history",
    });
    return { ok: false, error: failure.error };
  }
}
