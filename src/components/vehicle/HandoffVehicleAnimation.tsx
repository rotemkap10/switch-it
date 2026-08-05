"use client";

import { useEffect, useState } from "react";

import { VehicleIllustration } from "@/components/vehicle/VehicleIllustration";
import type { VehicleColor } from "@/lib/vehicle/colors";
import type { VehicleType } from "@/lib/vehicle/types";

type HandoffVehicleAnimationProps = {
  vehicleType: VehicleType;
  vehicleColor: VehicleColor;
  className?: string;
};

export function HandoffVehicleAnimation({
  vehicleType,
  vehicleColor,
  className = "",
}: HandoffVehicleAnimationProps) {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return (
    <div
      className={[
        "handoff-approach overflow-hidden rounded-[var(--radius-card)] border border-border/70 bg-accent-soft/40 px-2 py-2",
        className,
      ].join(" ")}
      data-testid="handoff-vehicle-animation"
      data-reduced-motion={reducedMotion ? "true" : "false"}
      aria-hidden="true"
    >
      <div className="handoff-approach-lane relative h-14">
        <div className="handoff-approach-road absolute inset-x-2 bottom-3 h-1 rounded-full bg-border/80" />
        <div
          className="handoff-approach-marker absolute bottom-2 right-3 flex h-7 w-7 items-center justify-center rounded-full border-2 border-accent-hover bg-surface"
          data-testid="handoff-approach-marker"
        >
          <span className="h-2 w-2 rounded-full bg-accent-hover" />
        </div>
        <div
          className={[
            "handoff-approach-vehicle absolute bottom-0 left-0",
            reducedMotion ? "handoff-approach-vehicle-static" : "motion-handoff-approach",
          ].join(" ")}
        >
          <VehicleIllustration
            vehicleType={vehicleType}
            vehicleColor={vehicleColor}
            animate={false}
            size="compact"
            className="!bg-transparent !p-0"
          />
        </div>
      </div>
    </div>
  );
}
