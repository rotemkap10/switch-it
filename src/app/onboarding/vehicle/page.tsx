import { OnboardingVehicleForm } from "@/components/onboarding/OnboardingVehicleForm";
import { requireAuthenticatedVehicleAccess } from "@/lib/auth/vehicle-access";

const emptyVehicle = {
  license_plate: null,
  vehicle_make: null,
  vehicle_model: null,
  vehicle_color: null,
  vehicle_type: null,
};

export default async function VehicleOnboardingPage() {
  const { status } = await requireAuthenticatedVehicleAccess({
    mode: "onboarding-only",
  });

  return (
    <main className="auth-page motion-page-enter" data-testid="onboarding-vehicle-page">
      <p className="auth-brand">Switch It</p>
      <div className="auth-page-header">
        <p className="auth-step-label">Step 2 of 2</p>
        <h1 className="auth-page-title">Tell drivers what to look for</h1>
        <p className="auth-page-helper">
          Your vehicle details help the other driver recognize you during a
          handoff.
        </p>
      </div>
      <div className="mobile-form-surface">
        <OnboardingVehicleForm
          initialVehicle={status.vehicle ?? emptyVehicle}
        />
      </div>
    </main>
  );
}
