"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";

import {
  publishSpot,
  type PublishSpotActionState,
} from "@/actions/spots";
import { useActionFeedback } from "@/components/feedback/useActionFeedback";
import { LeaveTimeChoices } from "@/components/spots/LeaveTimeChoices";
import { SpotLocationPickerLoader } from "@/components/spots/SpotLocationPickerLoader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { LEAVER_MAP_SHELL_HEIGHT_CLASS } from "@/lib/map/leaverMapShell";
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

function MapShellSkeleton({ message }: { message: string }) {
  return (
    <div
      className={[
        "flex w-full items-center justify-center",
        "rounded-[var(--radius-card)] border border-border bg-accent-soft",
        "text-sm text-muted",
        LEAVER_MAP_SHELL_HEIGHT_CLASS,
      ].join(" ")}
      role="status"
      aria-label="Map to adjust your parking spot location"
    >
      <span className="motion-location-indicator">{message}</span>
    </div>
  );
}

export function PublishSpotForm() {
  const [state, formAction, pending] = useActionState(
    publishSpot,
    initialState,
  );

  useActionFeedback(state, {
    toastErrors: true,
  });

  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [detectedLocation, setDetectedLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
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
        const { latitude: lat, longitude: lng } = position.coords;
        setDetectedLocation({ latitude: lat, longitude: lng });
        setLocation(lat, lng);
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
  const canRenderPicker =
    showMap && parsedLat !== null && parsedLng !== null;

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-4">
      <Card className="flex flex-col gap-6 motion-soft-scale-in">
        <section
          className="flex flex-col gap-3"
          aria-label="Location"
        >
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
            <div
              className="motion-fade-in flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[var(--radius-card)] border border-border bg-accent-soft px-3 py-2.5"
              role="status"
              data-testid="location-unavailable"
            >
              <p className="text-sm font-medium text-foreground">
                Location unavailable
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={requestLocation}
                  disabled={pending}
                  className="!px-2.5 !py-1 text-xs"
                >
                  Try again
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={chooseOnMap}
                  disabled={pending}
                  className="!px-2.5 !py-1 text-xs"
                >
                  Choose on map
                </Button>
              </div>
            </div>
          ) : null}

          {geoStatus === "loading" ? (
            <MapShellSkeleton message="Finding your location…" />
          ) : null}

          {canRenderPicker ? (
            <SpotLocationPickerLoader
              latitude={parsedLat}
              longitude={parsedLng}
              onLocationChange={handleMapLocationChange}
              disabled={pending}
              userLatitude={detectedLocation?.latitude ?? null}
              userLongitude={detectedLocation?.longitude ?? null}
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

          <div>
            <button
              type="button"
              aria-expanded={showManualCoords}
              onClick={() => setShowManualCoords((open) => !open)}
              className="w-fit text-left text-xs text-muted underline-offset-2 hover:text-foreground hover:underline"
            >
              Enter coordinates manually
            </button>
            {showManualCoords ? (
              <div className="motion-reveal-panel is-open">
                <div className="motion-reveal-panel-inner grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
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
              </div>
            ) : null}
          </div>

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

        <div className="flex flex-col gap-2">
          <Button
            type="submit"
            disabled={pending || !hasLocation}
            loading={pending}
            className="min-w-[9.5rem] w-full sm:w-fit"
          >
            {pending ? "Sharing…" : "Share spot"}
          </Button>
          <p className="text-xs leading-5 text-muted">
            This coordinates a handoff; it does not reserve the spot.
          </p>
        </div>
      </Card>
    </form>
  );
}
