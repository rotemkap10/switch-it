import Link from "next/link";

import { Alert } from "@/components/ui/Alert";
import { requireUser } from "@/lib/auth/require-user";
import { getAuthenticatedVehicleStatus } from "@/lib/auth/vehicle-status";

export async function VehicleSetupReminder() {
  const { supabase, user } = await requireUser();
  const status = await getAuthenticatedVehicleStatus(supabase, user.id);

  if (status.vehicleComplete || !status.hasActiveHandoff) {
    return null;
  }

  return (
    <div className="px-4 pt-3 md:px-0">
      <Alert tone="info">
        Add your vehicle details after this handoff so future exchanges are
        easier.{" "}
        <Link
          href="/profile"
          className="font-medium text-accent-hover underline-offset-2 hover:underline"
        >
          Complete vehicle setup
        </Link>
      </Alert>
    </div>
  );
}
