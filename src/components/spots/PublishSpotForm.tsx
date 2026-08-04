"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";

import {
  publishSpot,
  type PublishSpotActionState,
} from "@/actions/spots";
import { LeaveTimeChoices } from "@/components/spots/LeaveTimeChoices";
import { SpotLocationPickerLoader } from "@/components/spots/SpotLocationPickerLoader";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import {
  type AvailableInMinutes,
  GEOLOCATION_TIMEOUT_MS,
} from "@/lib/spots/constants";
import { MAP_DEFAULT_CENTER } from "@/types/map-spot";

const initialState: PublishSpotActionState = {};

type GeoStatus = "loading" | "success" | "error" | "manual";

function formatCoord(value: number): string {
  return value.toFixed(6);
}

function parseCoord(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function PublishSpotForm() {
  const [state, formAction, pending] = useActionState(
    publishSpot,
    initialState,
  );
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [leaveInMinutes, setLeaveInMinutes] = useState<AvailableInMinutes>(0);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("loading");
  const [showManualCoords, setShowManualCoords] = useState(false);
  const autoRequestedRef = useRef(false);

  const hasLocation = latitude !== "" && longitude !== "";
  const showMap =
    geoStatus === "success" || geoStatus === "manual" || hasLocation;

  const setLocation = useCallback((lat: number, lng: number) => {
    setLatitude(formatCoord(lat));
    setLongitude(formatCoord(lng));
  }, []);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoStatus("error");
      return;
    }

    setGeoStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation(position.coords.latitude, position.coords.longitude);
        setGeoStatus("success");
      },
      () => {
        setGeoStatus("error");
      },
      {
        enableHighAccuracy: true,
        timeout: GEOLOCATION_TIMEOUT_MS,
        maximumAge: 60_000,
      },
    );
  }, [setLocation]);

  useEffect(() => {
    if (autoRequestedRef.current) {
      return;
    }
    autoRequestedRef.current = true;
    requestLocation();
  }, [requestLocation]);

  function chooseOnMap() {
    if (!hasLocation) {
      setLocation(MAP_DEFAULT_CENTER.lat, MAP_DEFAULT_CENTER.lng);
    }
    setGeoStatus("manual");
  }

  function handleMapLocationChange(lat: number, lng: number) {
    setLocation(lat, lng);
    if (geoStatus !== "manual") {
      setGeoStatus("success");
    }
  }

  const parsedLat = parseCoord(latitude);
  const parsedLng = parseCoord(longitude);

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-4">
      <Card className="flex flex-col gap-6 motion-soft-scale-in">
        <section className="flex flex-col gap-3" aria-labelledby="spot-location-heading">
          <div>
            <h2
              id="spot-location-heading"
              className="text-base font-semibold text-foreground"
            >
              Your parking spot
            </h2>
            <p className="mt-1 text-sm text-muted">
              Check that the marker is in the right place.
            </p>
          </div>

          {geoStatus === "loading" ? (
            <p
              className="motion-location-indicator text-sm font-medium text-foreground"
              role="status"
            >
              Finding your location…
            </p>
          ) : null}

          {geoStatus === "success" && hasLocation ? (
            <p
              className="motion-success-flash text-sm font-medium text-success"
              role="status"
            >
              Location found
            </p>
          ) : null}

          {geoStatus === "error" ? (
            <div className="motion-fade-in flex flex-col gap-3">
              <Alert tone="warning" title="We couldn’t access your location.">
                You can try again or choose the spot on the map.
              </Alert>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={requestLocation}
                  disabled={pending}
                >
                  Try again
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={chooseOnMap}
                  disabled={pending}
                >
                  Choose on map
                </Button>
              </div>
            </div>
          ) : null}

          {showMap && parsedLat !== null && parsedLng !== null ? (
            <SpotLocationPickerLoader
              latitude={parsedLat}
              longitude={parsedLng}
              onLocationChange={handleMapLocationChange}
              disabled={pending}
            />
          ) : null}

          {!showManualCoords ? (
            <>
              <input type="hidden" name="latitude" value={latitude} />
              <input type="hidden" name="longitude" value={longitude} />
            </>
          ) : null}
          <input
            type="hidden"
            name="available_in_minutes"
            value={String(leaveInMinutes)}
          />

          {!showManualCoords ? (
            <button
              type="button"
              onClick={() => setShowManualCoords(true)}
              className="w-fit text-left text-xs text-muted underline-offset-2 hover:text-foreground hover:underline"
            >
              Enter coordinates manually
            </button>
          ) : (
            <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
              <Input
                id="latitude-manual"
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
                id="longitude-manual"
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
          )}

          {!showManualCoords && state.fieldErrors?.latitude?.[0] ? (
            <p className="text-sm text-danger" role="alert">
              {state.fieldErrors.latitude[0]}
            </p>
          ) : null}
          {!showManualCoords && state.fieldErrors?.longitude?.[0] ? (
            <p className="text-sm text-danger" role="alert">
              {state.fieldErrors.longitude[0]}
            </p>
          ) : null}
        </section>

        <section aria-labelledby="leave-time-label">
          <LeaveTimeChoices
            value={leaveInMinutes}
            onChange={setLeaveInMinutes}
            disabled={pending}
            error={state.fieldErrors?.available_in_minutes?.[0]}
          />
        </section>

        {state.error ? <Alert tone="error">{state.error}</Alert> : null}

        <div className="flex flex-col gap-2">
          <Button
            type="submit"
            disabled={pending || !hasLocation}
            loading={pending}
            className="min-w-[9.5rem] w-full sm:w-fit"
          >
            {pending ? "Sharing…" : "Share this spot"}
          </Button>
          <p className="text-xs leading-5 text-muted">
            This helps coordinate a handoff. It does not reserve the spot.
          </p>
        </div>
      </Card>
    </form>
  );
}
