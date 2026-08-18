import { AuthenticatedShell } from "@/components/auth/AuthenticatedShell";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { ProfileSummaryRow } from "@/components/profile/ProfileSummaryRow";
import { NotificationsStatus } from "@/components/profile/NotificationsStatus";
import { SensoryPreferences } from "@/components/profile/SensoryPreferences";
import { VehicleForm } from "@/components/profile/VehicleForm";
import { Alert } from "@/components/ui/Alert";
import { requireAuthenticatedVehicleAccess } from "@/lib/auth/vehicle-access";
import { isVehicleProfileComplete } from "@/lib/vehicle/profile-fields";

export default async function ProfilePage() {
  const { supabase, user, status } = await requireAuthenticatedVehicleAccess({
    mode: "allow-incomplete",
  });

  const { data: profile, error } = await supabase
    .from("profiles")
    .select(
      "display_name, credits, role, license_plate, vehicle_make, vehicle_model, vehicle_year, vehicle_color, vehicle_type, vehicle_photo_path",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile) {
    return (
      <AuthenticatedShell
        title="Profile"
        description="Manage your account and vehicle."
        vehicleAccess="allow-incomplete"
        headerAlign="center"
      >
        <Alert tone="error">Your profile could not be loaded.</Alert>
      </AuthenticatedShell>
    );
  }

  const vehicle = {
    license_plate: profile.license_plate,
    vehicle_make: profile.vehicle_make,
    vehicle_model: profile.vehicle_model,
    vehicle_year:
      typeof profile.vehicle_year === "number" ? profile.vehicle_year : null,
    vehicle_color: profile.vehicle_color,
    vehicle_type: profile.vehicle_type,
    vehicle_photo_path: profile.vehicle_photo_path ?? null,
  };
  const vehicleComplete = isVehicleProfileComplete(vehicle);

  return (
    <AuthenticatedShell
      title="Profile"
      description="Manage your account and vehicle."
      vehicleAccess="allow-incomplete"
      headerAlign="center"
    >
      <div className="profile-page" data-testid="profile-layout">
        <ProfileSummaryRow
          email={user.email}
          credits={profile.credits}
          vehicleComplete={vehicleComplete}
          vehicle={vehicle}
        />

        <section
          className="mobile-form-section"
          aria-labelledby="profile-display-name-title"
        >
          <h2
            id="profile-display-name-title"
            className="mobile-form-section-title"
          >
            Display name
          </h2>
          <ProfileForm initialDisplayName={profile.display_name} />
        </section>

        <section
          className="mobile-form-section"
          aria-labelledby="profile-notifications-title"
        >
          <h2
            id="profile-notifications-title"
            className="mobile-form-section-title"
          >
            Notifications
          </h2>
          <NotificationsStatus />
        </section>

        <section
          className="mobile-form-section"
          aria-labelledby="profile-feedback-title"
        >
          <h2 id="profile-feedback-title" className="mobile-form-section-title">
            Sounds & haptics
          </h2>
          <p className="mobile-form-section-helper">
            Optional cues for important parking handoff events on this device.
          </p>
          <SensoryPreferences />
        </section>

        <section
          className="mobile-form-section"
          aria-labelledby="profile-vehicle-title"
        >
          <h2 id="profile-vehicle-title" className="mobile-form-section-title">
            Your vehicle
          </h2>
          <p className="mobile-form-section-helper">
            Used to recognize drivers during a handoff.
          </p>
          <VehicleForm
            initialVehicle={vehicle}
            requiresSetup={!status.vehicleComplete}
          />
        </section>
      </div>
    </AuthenticatedShell>
  );
}
