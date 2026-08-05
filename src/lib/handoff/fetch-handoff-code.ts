import type { SupabaseClient } from "@supabase/supabase-js";

export async function fetchHandoffCode(
  supabase: SupabaseClient,
  claimId: string,
): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_handoff_code", {
    p_claim_id: claimId,
  });

  if (error) {
    console.error("Could not load handoff code.");
    return null;
  }

  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  const row = data[0];
  if (
    !row ||
    typeof row !== "object" ||
    typeof (row as { handoff_code?: unknown }).handoff_code !== "string"
  ) {
    return null;
  }

  return (row as { handoff_code: string }).handoff_code;
}
