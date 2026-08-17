import type { ReactNode } from "react";

import { AuthenticatedFrame } from "@/components/auth/AuthenticatedFrame";
import {
  requireAuthenticatedVehicleAccess,
  type VehicleAccessMode,
  type VehicleHandoffException,
} from "@/lib/auth/vehicle-access";
import type { requireUser } from "@/lib/auth/require-user";
import type { AuthenticatedVehicleStatus } from "@/lib/auth/vehicle-status";

export type AuthenticatedAccess = {
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"];
  user: Awaited<ReturnType<typeof requireUser>>["user"];
  status: AuthenticatedVehicleStatus;
};

type AuthenticatedShellProps = {
  title: string;
  description: string;
  children?: ReactNode;
  /** Immersive map layout: no page header, full-height main. */
  layout?: "default" | "map";
  /** Vehicle onboarding gate for this route. */
  vehicleAccess?: VehicleAccessMode;
  /** Allow incomplete users when they have an active handoff on this route. */
  handoffException?: VehicleHandoffException;
  /**
   * Optional pre-resolved auth — avoids a second requireUser/vehicle check
   * when the page already called requireAuthenticatedVehicleAccess.
   */
  access?: AuthenticatedAccess;
};

export async function AuthenticatedShell({
  title,
  description,
  children,
  layout = "default",
  vehicleAccess = "require-complete",
  handoffException = null,
  access: accessProp,
}: AuthenticatedShellProps) {
  const access =
    accessProp ??
    (await requireAuthenticatedVehicleAccess({
      mode: vehicleAccess,
      handoffException,
    }));

  const { supabase, user } = access;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  const displayName =
    profile && typeof profile.display_name === "string"
      ? profile.display_name
      : null;

  return (
    <AuthenticatedFrame
      userId={user.id}
      title={title}
      description={description}
      layout={layout}
      displayName={displayName}
      hasActiveHandoff={access.status.hasActiveHandoff}
    >
      {children}
    </AuthenticatedFrame>
  );
}
