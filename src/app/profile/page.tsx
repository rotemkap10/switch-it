import { AuthenticatedShell } from "@/components/auth/AuthenticatedShell";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { VehicleForm } from "@/components/profile/VehicleForm";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
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

  const vehicleComplete = isVehicleProfileComplete(profile);

  return (
    <AuthenticatedShell
      title="Profile"
      description="Manage your Switch It account details."
      vehicleAccess="allow-incomplete"
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm font-medium text-muted">Email</p>
          <p className="mt-2 break-all text-foreground">{user.email ?? "—"}</p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-muted">Credits</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {profile.credits}
          </p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-muted">Vehicle status</p>
          <div className="mt-2">
            <Badge tone={vehicleComplete ? "success" : "warning"}>
              {vehicleComplete ? "Vehicle ready" : "Vehicle setup required"}
            </Badge>
          </div>
        </Card>
      </div>

      <Card className="flex max-w-lg flex-col gap-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Display name
          </h2>
          <p className="mt-1 text-sm text-muted">
            This is how you appear in the app. Credits and role stay read-only.
          </p>
        </div>
        <ProfileForm initialDisplayName={profile.display_name} />
      </Card>

      <Card className="flex max-w-lg flex-col gap-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Your vehicle
          </h2>
          <p className="mt-1 text-sm text-muted">
            This helps drivers recognize each other during a parking handoff.
          </p>
        </div>
        <VehicleForm
          initialVehicle={{
            license_plate: profile.license_plate,
            vehicle_make: profile.vehicle_make,
            vehicle_model: profile.vehicle_model,
            vehicle_color: profile.vehicle_color,
            vehicle_type: profile.vehicle_type,
          }}
          requiresSetup={!status.vehicleComplete}
        />
      </Card>
    </AuthenticatedShell>
  );
}
