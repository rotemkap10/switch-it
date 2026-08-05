import { OnboardingVehicleForm } from "@/components/onboarding/OnboardingVehicleForm";
import { Card } from "@/components/ui/Card";
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
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-12 sm:px-6">
      <div className="space-y-2">
        <p className="text-sm font-medium text-accent-hover">Step 2 of 2</p>
        <h1 className="text-2xl font-semibold text-foreground">Add your vehicle</h1>
        <p className="text-sm text-muted">
          Drivers use these details to recognize each other during a parking
          handoff.
        </p>
      </div>

      <Card>
        <OnboardingVehicleForm
          initialVehicle={status.vehicle ?? emptyVehicle}
        />
      </Card>
    </main>
  );
}
