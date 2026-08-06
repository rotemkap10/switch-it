"use client";

import { CheckMarkIcon } from "@/components/illustrations/CheckMarkIcon";
import { EmailMarkIcon } from "@/components/illustrations/UserInitialAvatar";
import { CreditsSummaryCard } from "@/components/profile/CreditsSummaryCard";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { getVehicleSummaryLines } from "@/lib/vehicle/format-summary";
import { useOneShotAnimation } from "@/lib/motion/use-one-shot-animation";
import type { VehicleProfileFields } from "@/lib/vehicle/profile-fields";

type ProfileSummaryRowProps = {
  email: string | null | undefined;
  credits: number;
  vehicleComplete: boolean;
  vehicle: VehicleProfileFields;
};

export function ProfileSummaryRow({
  email,
  credits,
  vehicleComplete,
  vehicle,
}: ProfileSummaryRowProps) {
  const readyPop = useOneShotAnimation(
    vehicleComplete ? "profile-vehicle-ready-badge" : null,
  );
  const summary = getVehicleSummaryLines(vehicle);

  return (
    <div className="profile-summary-grid" data-testid="profile-summary-row">
      <Card className="profile-summary-card">
        <CreditsSummaryCard credits={credits} />
      </Card>

      <Card className="profile-summary-card">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Vehicle
          </p>
          <span
            className={[
              "inline-flex items-center gap-1",
              vehicleComplete && readyPop ? "motion-badge-fade-in" : "",
            ].join(" ")}
          >
            {vehicleComplete ? (
              <CheckMarkIcon className="h-4 w-4" animated={readyPop} />
            ) : null}
            <Badge tone={vehicleComplete ? "success" : "warning"}>
              {vehicleComplete ? "Vehicle ready" : "Setup required"}
            </Badge>
          </span>
        </div>
        <div className="mt-auto min-w-0" data-testid="vehicle-top-summary">
          {summary ? (
            <>
              <p className="truncate text-sm font-semibold text-foreground">
                {summary.colorType}
              </p>
              <p className="mt-1 truncate text-xs text-muted sm:text-sm">
                <span className="vehicle-plate-display !text-xs">
                  {summary.plate}
                </span>
              </p>
            </>
          ) : (
            <p className="text-sm text-muted">No vehicle details yet</p>
          )}
        </div>
      </Card>

      <Card className="profile-summary-card profile-summary-email">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Email
          </p>
          <EmailMarkIcon className="h-5 w-5 shrink-0" />
        </div>
        <p
          className="mt-auto break-all text-sm leading-snug text-foreground sm:text-[0.9375rem]"
          data-testid="profile-email-value"
        >
          {email?.trim() ? email : "—"}
        </p>
      </Card>
    </div>
  );
}
