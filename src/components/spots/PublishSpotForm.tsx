"use client";

import { useActionState, useState } from "react";

import {
  publishSpot,
  type PublishSpotActionState,
} from "@/actions/spots";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  AVAILABLE_IN_MINUTES_OPTIONS,
  GEOLOCATION_TIMEOUT_MS,
  SPOT_GRACE_MINUTES,
} from "@/lib/spots/constants";

const initialState: PublishSpotActionState = {};

const availableLabels: Record<number, string> = {
  0: "Now",
  5: "In 5 minutes",
  10: "In 10 minutes",
  15: "In 15 minutes",
  20: "In 20 minutes",
  25: "In 25 minutes",
  30: "In 30 minutes",
};

export function PublishSpotForm() {
  const [state, formAction, pending] = useActionState(
    publishSpot,
    initialState,
  );
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [geoError, setGeoError] = useState<string | null>(null);
  const [geoPending, setGeoPending] = useState(false);

  function useCurrentLocation() {
    setGeoError(null);

    if (!navigator.geolocation) {
      setGeoError(
        "Location is not supported in this browser. Enter coordinates manually.",
      );
      return;
    }

    setGeoPending(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(6));
        setLongitude(position.coords.longitude.toFixed(6));
        setGeoPending(false);
      },
      () => {
        setGeoError("Location unavailable. Enter coordinates manually.");
        setGeoPending(false);
      },
      {
        enableHighAccuracy: true,
        timeout: GEOLOCATION_TIMEOUT_MS,
        maximumAge: 60_000,
      },
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Location</h2>
            <p className="text-sm text-muted">
              Use your current position or enter coordinates manually.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={useCurrentLocation}
            disabled={pending || geoPending}
          >
            {geoPending ? "Getting location…" : "Use my location"}
          </Button>
        </div>

        {geoError ? <Alert tone="warning">{geoError}</Alert> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            id="latitude"
            name="latitude"
            label="Latitude"
            type="number"
            step="any"
            required
            min={-90}
            max={90}
            value={latitude}
            onChange={(event) => setLatitude(event.target.value)}
            disabled={pending}
            error={state.fieldErrors?.latitude?.[0]}
          />
          <Input
            id="longitude"
            name="longitude"
            label="Longitude"
            type="number"
            step="any"
            required
            min={-180}
            max={180}
            value={longitude}
            onChange={(event) => setLongitude(event.target.value)}
            disabled={pending}
            error={state.fieldErrors?.longitude?.[0]}
          />
        </div>

        <Input
          id="address"
          name="address"
          label="Address (optional)"
          type="text"
          maxLength={200}
          disabled={pending}
          placeholder="Street or landmark"
          error={state.fieldErrors?.address?.[0]}
        />
      </Card>

      <Card className="flex flex-col gap-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            When are you leaving?
          </h2>
          <p className="text-sm text-muted">
            The spot appears on the map immediately. After your leave time, it
            stays claimable for a {SPOT_GRACE_MINUTES}-minute grace period.
          </p>
        </div>

        <Select
          id="available_in_minutes"
          name="available_in_minutes"
          label="Expected leave time"
          defaultValue="0"
          disabled={pending}
          error={state.fieldErrors?.available_in_minutes?.[0]}
          options={AVAILABLE_IN_MINUTES_OPTIONS.map((minutes) => ({
            value: String(minutes),
            label: availableLabels[minutes],
          }))}
        />
      </Card>

      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Sharing…" : "Share my parking spot"}
      </Button>
    </form>
  );
}
