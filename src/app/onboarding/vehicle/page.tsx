import { AuthBrand } from "@/components/brand/AuthBrand";
import { OnboardingVehicleForm } from "@/components/onboarding/OnboardingVehicleForm";
import { InitialShellReadyMarker } from "@/components/shell/InitialShellReadyMarker";
import { requireAuthenticatedVehicleAccess } from "@/lib/auth/vehicle-access";

const emptyVehicle = {
  license_plate: null,
  vehicle_make: null,
  vehicle_model: null,
  vehicle_year: null,
  vehicle_color: null,
  vehicle_type: null,
  vehicle_photo_path: null,
};

export default async function VehicleOnboardingPage() {
  const { status } = await requireAuthenticatedVehicleAccess({
    mode: "onboarding-only",
  });
  const initialVehicle = status.vehicle ?? emptyVehicle;

  return (
    <main className="auth-page motion-page-enter" data-testid="onboarding-vehicle-page">
      <InitialShellReadyMarker />
      <AuthBrand />
      <div className="auth-page-header">
        <p className="auth-step-label">Step 2 of 2</p>
        <h1 className="auth-page-title">Tell drivers what to look for</h1>
        <p className="auth-page-helper">
          Your vehicle details help the other driver recognize you during a
          handoff.
        </p>
      </div>
      <div className="mobile-form-surface">
        <OnboardingVehicleForm initialVehicle={initialVehicle} />
      </div>
    </main>
  );
}
