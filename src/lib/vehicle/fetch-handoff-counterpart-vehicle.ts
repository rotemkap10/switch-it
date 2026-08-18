import type { SupabaseClient } from "@supabase/supabase-js";

import {
  mapHandoffVehicleRow,
  type HandoffVehicle,
  type HandoffVehicleRow,
} from "@/lib/vehicle/handoff-vehicle";

export async function fetchHandoffCounterpartVehicle(
  supabase: SupabaseClient,
  claimId: string,
): Promise<HandoffVehicle | null> {
  const { data, error } = await supabase.rpc("get_handoff_counterpart_vehicle", {
    p_claim_id: claimId,
  });

  if (error) {
    console.error("Could not load handoff counterpart vehicle.");
    return null;
  }

  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  const row = data[0];
  if (!row || typeof row !== "object") {
    return null;
  }

  return mapHandoffVehicleRow(row as HandoffVehicleRow);
}
