import { AuthenticatedShell } from "@/components/auth/AuthenticatedShell";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { ProfileSummaryRow } from "@/components/profile/ProfileSummaryRow";
import { VehicleForm } from "@/components/profile/VehicleForm";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { requireAuthenticatedVehicleAccess } from "@/lib/auth/vehicle-access";
import { isVehicleProfileComplete } from "@/lib/vehicle/profile-fields";

export default async function ProfilePage() {
  const { supabase, user, status } = await requireAuthenticatedVehicleAccess({
    mode: "allow-incomplete",
  });

  const { data: profile, error } = await supabase
    .from("profiles")
    .select(
      "display_name, credits, role, license_plate, vehicle_make, vehicle_model, vehicle_color, vehicle_type",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile) {
    return (
      <AuthenticatedShell
        title="Profile"
        description="Manage your Switch It account details."
        vehicleAccess="allow-incomplete"
      >
        <Alert tone="error">Your profile could not be loaded.</Alert>
      </AuthenticatedShell>
    );
  }

  const vehicle = {
    license_plate: profile.license_plate,
    vehicle_make: profile.vehicle_make,
    vehicle_model: profile.vehicle_model,
    vehicle_color: profile.vehicle_color,
    vehicle_type: profile.vehicle_type,
  };
  const vehicleComplete = isVehicleProfileComplete(vehicle);

  return (
    <AuthenticatedShell
      title="Profile"
      description="Manage your Switch It account details."
      vehicleAccess="allow-incomplete"
    >
      <div
        className="mx-auto flex w-full max-w-3xl flex-col gap-4 sm:gap-5"
        data-testid="profile-layout"
      >
        <ProfileSummaryRow
          email={user.email}
          credits={profile.credits}
          vehicleComplete={vehicleComplete}
          vehicle={vehicle}
        />

        <Card className="flex flex-col gap-3 !p-4 sm:!p-5">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Display name
            </h2>
            <p className="mt-0.5 text-xs text-muted sm:text-sm">
              How you appear in the app.
            </p>
          </div>
          <ProfileForm initialDisplayName={profile.display_name} />
        </Card>

        <Card className="flex flex-col gap-3 !p-4 sm:!p-5">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Your vehicle
            </h2>
            <p className="mt-0.5 text-xs text-muted sm:text-sm">
              Helps drivers recognize each other during a handoff.
            </p>
          </div>
          <VehicleForm
            initialVehicle={vehicle}
            requiresSetup={!status.vehicleComplete}
          />
        </Card>
      </div>
    </AuthenticatedShell>
  );
}
