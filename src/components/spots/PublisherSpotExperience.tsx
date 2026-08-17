"use client";

import { useCallback, useState } from "react";

import {
  PublisherSpotCard,
  type PublisherSpotSummary,
} from "@/components/spots/PublisherSpotCard";
import { PublisherRealtimeSync } from "@/components/spots/PublisherRealtimeSync";
import {
  mergePublisherSpotFromServer,
  type PublisherClaimHint,
} from "@/lib/realtime/publisher-spot-sync";
import type { HandoffVehicle } from "@/lib/vehicle/handoff-vehicle";

type PublisherSpotExperienceProps = {
  userId: string;
  spot: PublisherSpotSummary;
  activeClaimId: string | null;
  counterpartVehicle?: HandoffVehicle | null;
  ownVehicle?: HandoffVehicle | null;
  handoffCode?: string | null;
};

/**
 * Client bridge: Realtime claim hints + RSC refresh without stale waiting UI.
 */
export function PublisherSpotExperience({
  userId,
  spot: serverSpot,
  activeClaimId: serverClaimId,
  counterpartVehicle = null,
  ownVehicle = null,
  handoffCode = null,
}: PublisherSpotExperienceProps) {
  const [claimHint, setClaimHint] = useState<PublisherClaimHint | null>(null);

  const onClaimHint = useCallback((hint: PublisherClaimHint) => {
    setClaimHint(hint);
  }, []);

  const merged = mergePublisherSpotFromServer(
    serverSpot,
    serverClaimId,
    claimHint,
  );

  return (
    <>
      <PublisherRealtimeSync
        userId={userId}
        spotId={serverSpot.id}
        claimId={serverClaimId}
        onClaimHint={onClaimHint}
      />
      <PublisherSpotCard
        spot={merged.spot}
        layout="page"
        counterpartVehicle={counterpartVehicle}
        ownVehicle={ownVehicle}
        handoffCode={handoffCode}
        activeClaimId={merged.activeClaimId}
      />
    </>
  );
}
