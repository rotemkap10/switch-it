import { AuthenticatedShell } from "@/components/auth/AuthenticatedShell";
import { VehicleSetupReminder } from "@/components/onboarding/VehicleSetupReminder";
import { PublishSpotForm } from "@/components/spots/PublishSpotForm";
import {
  PublisherSpotExperience,
} from "@/components/spots/PublisherSpotExperience";
import { Alert } from "@/components/ui/Alert";
import { requireAuthenticatedVehicleAccess } from "@/lib/auth/vehicle-access";
import { runRscQuery } from "@/lib/server/rsc-recovery";
import {
  resolvePublisherSpotView,
  toPublisherSpot,
} from "@/lib/spots/publisher-spot-view";
import { fetchHandoffCounterpartVehicle } from "@/lib/vehicle/fetch-handoff-counterpart-vehicle";
import { mapProfileVehicleToHandoff } from "@/lib/vehicle/handoff-vehicle";

export default async function NewSpotPage() {
  const access = await requireAuthenticatedVehicleAccess({
    mode: "require-complete",
    handoffException: "active-publisher",
  });
  const { supabase, user } = access;

  await runRscQuery(
    "expire_open_publisher_spot",
    async () => {
      const { data: openSpot } = await supabase
        .from("parking_spots")
        .select("id, status")
        .eq("owner_id", user.id)
        .in("status", ["available", "claimed"])
        .maybeSingle();

      if (openSpot && typeof openSpot.id === "string") {
        if (openSpot.status === "available") {
          await supabase.rpc("expire_spot_if_needed", {
            p_spot_id: openSpot.id,
          });
        } else if (openSpot.status === "claimed") {
          const { data: claimOnSpot } = await supabase
            .from("claims")
            .select("id")
            .eq("spot_id", openSpot.id)
            .eq("status", "active")
            .maybeSingle();
          if (claimOnSpot && typeof claimOnSpot.id === "string") {
            await supabase.rpc("expire_claim_if_needed", {
              p_claim_id: claimOnSpot.id,
            });
          }
        }
      }
    },
    undefined,
    { route: "/spots/new" },
  );

  const spotLoad = await runRscQuery(
    "load_publisher_open_spot",
    async () => {
      const { data, error } = await supabase
        .from("parking_spots")
        .select(
          "id, status, available_at, expires_at, handoff_started_at, handoff_extension_used_at, address, latitude, longitude",
        )
        .eq("owner_id", user.id)
        .in("status", ["available", "claimed"])
        .maybeSingle();

      if (error) {
        return { spot: toPublisherSpot(data), failed: true };
      }

      return { spot: toPublisherSpot(data), failed: false };
    },
    { spot: null, failed: true },
    { route: "/spots/new" },
  );

  const view = resolvePublisherSpotView({
    loadFailed: spotLoad.failed,
    spot: spotLoad.spot,
  });
  const publisherSpot = view.spot;

  const ownVehicle = await runRscQuery(
    "load_publisher_own_vehicle",
    async () => {
      const { data: ownProfile } = await supabase
        .from("profiles")
        .select(
          "license_plate, vehicle_make, vehicle_model, vehicle_year, vehicle_color, vehicle_type",
        )
        .eq("id", user.id)
        .maybeSingle();
      return mapProfileVehicleToHandoff(ownProfile);
    },
    null,
    { route: "/spots/new" },
  );

  let counterpartVehicle = null;
  let activeClaimId: string | null = null;
  if (publisherSpot?.status === "claimed") {
    const claimedSpotId = publisherSpot.id;
    const claimLoad = await runRscQuery(
      "load_publisher_active_claim",
      async () => {
        const { data: activeClaim, error } = await supabase
          .from("claims")
          .select("id")
          .eq("spot_id", claimedSpotId)
          .eq("status", "active")
          .maybeSingle();
        if (error) {
          return null;
        }
        return typeof activeClaim?.id === "string" ? activeClaim.id : null;
      },
      null,
      { route: "/spots/new", spotId: claimedSpotId },
    );

    if (claimLoad) {
      activeClaimId = claimLoad;
      counterpartVehicle = await fetchHandoffCounterpartVehicle(
        supabase,
        claimLoad,
      );
    }
  }

  return (
    <AuthenticatedShell
      layout={view.layout}
      title="Share a spot"
      description=""
      handoffException="active-publisher"
      access={access}
      headerAlign="center"
    >
      {view.showCompose ? null : <VehicleSetupReminder />}
      {view.showLoadError ? (
        <Alert tone="error">Could not load your parking spot.</Alert>
      ) : null}

      {publisherSpot ? (
        <PublisherSpotExperience
          userId={user.id}
          spot={publisherSpot}
          activeClaimId={activeClaimId}
          counterpartVehicle={counterpartVehicle}
          ownVehicle={ownVehicle}
        />
      ) : view.showCompose ? (
        <PublishSpotForm />
      ) : null}
    </AuthenticatedShell>
  );
}
