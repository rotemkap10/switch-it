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
};

/**
 * Client bridge: Realtime claim hints + mutation patches + RSC refresh
 * without crashing on a stale intermediate tree.
 */
export function PublisherSpotExperience({
  userId,
  spot: serverSpot,
  activeClaimId: serverClaimId,
  counterpartVehicle = null,
  ownVehicle = null,
}: PublisherSpotExperienceProps) {
  const [claimHint, setClaimHint] = useState<PublisherClaimHint | null>(null);

  const onClaimHint = useCallback((hint: PublisherClaimHint) => {
    setClaimHint((previous) => {
      if (!previous || previous.spotId !== hint.spotId) {
        return hint;
      }
      return {
        ...previous,
        ...hint,
        claimId: hint.claimId ?? previous.claimId,
        handoffStartedAt: hint.handoffStartedAt ?? previous.handoffStartedAt,
        expiresAt: hint.expiresAt ?? previous.expiresAt,
        extensionUsedAt: hint.extensionUsedAt ?? previous.extensionUsedAt,
        promoteToClaimed: hint.promoteToClaimed ?? previous.promoteToClaimed,
      };
    });
  }, []);

  const onHandoffMutation = useCallback(
    (patch: {
      handoffStartedAt?: string;
      expiresAt?: string;
      extensionUsedAt?: string | null;
    }) => {
      onClaimHint({
        spotId: serverSpot.id,
        claimId: serverClaimId,
        source: "mutation",
        promoteToClaimed: serverSpot.status === "claimed",
        handoffStartedAt: patch.handoffStartedAt,
        expiresAt: patch.expiresAt,
        extensionUsedAt: patch.extensionUsedAt,
      });
    },
    [onClaimHint, serverClaimId, serverSpot.id, serverSpot.status],
  );

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
        activeClaimId={merged.activeClaimId}
        onHandoffMutation={onHandoffMutation}
      />
    </>
  );
}
