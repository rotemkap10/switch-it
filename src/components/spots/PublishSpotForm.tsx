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
import { Input } from "@/components/ui/Input";
import { PUBLISHER_SPOT_ADDRESS_FALLBACK } from "@/lib/geocoding/location-display";
import { useReverseGeocode } from "@/lib/geocoding/use-reverse-geocode";
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

function AddressLookupSummary({
  geoStatus,
  hasLocation,
  lookupStatus,
  addressLabel,
  isUpdating,
}: {
  geoStatus: GeoStatus;
  hasLocation: boolean;
  lookupStatus: "idle" | "loading" | "success" | "unavailable";
  addressLabel: string | null;
  isUpdating: boolean;
}) {
  if (geoStatus === "loading") {
    return (
      <p
        className="publisher-location-status publisher-location-status--muted motion-location-indicator"
        role="status"
        aria-live="polite"
        data-testid="publisher-location-status"
      >
        Finding your location…
      </p>
    );
  }

  if (!hasLocation || geoStatus === "error") {
    return null;
  }

  const showResolved =
    lookupStatus === "success" && addressLabel && !isUpdating;
  const showLoading = lookupStatus === "loading" || isUpdating;
  const showInitialIdle =
    lookupStatus === "idle" && !addressLabel && !isUpdating;
  const showFallback =
    lookupStatus === "unavailable" ||
    (lookupStatus === "success" && !addressLabel && !isUpdating);

  if (showLoading) {
    return (
      <div
        className="publisher-location-summary"
        role="status"
        aria-live="polite"
        data-testid="publisher-address-summary"
      >
        {addressLabel ? (
          <p className="publisher-location-summary__previous motion-location-indicator">
            {addressLabel}
          </p>
        ) : (
          <p className="publisher-location-status publisher-location-status--success">
            Location selected
          </p>
        )}
        <p className="publisher-location-summary__loading motion-location-indicator">
          Finding the address…
        </p>
        <p className="mt-0.5 text-xs leading-5 text-muted">
          You can move the map to adjust the spot.
        </p>
      </div>
    );
  }

  if (showResolved) {
    return (
      <div
        className="publisher-location-summary motion-fade-in"
        role="status"
        aria-live="polite"
        data-testid="publisher-address-summary"
      >
        <p className="publisher-location-summary__label">Selected location</p>
        <p
          className="publisher-location-summary__value"
          data-testid="publisher-address-label"
        >
          {addressLabel}
        </p>
        <p className="mt-0.5 text-xs leading-5 text-muted">
          You can move the map to adjust the spot.
        </p>
      </div>
    );
  }

  if (showFallback) {
    return (
      <div
        className="publisher-location-summary"
        role="status"
        aria-live="polite"
        data-testid="publisher-address-summary"
      >
        <p
          className="publisher-location-status publisher-location-status--success"
          data-testid="publisher-location-status"
        >
          {PUBLISHER_SPOT_ADDRESS_FALLBACK}
        </p>
        <p className="mt-0.5 text-xs leading-5 text-muted">
          You can move the map to adjust the spot.
        </p>
      </div>
    );
  }

  if (showInitialIdle) {
    return (
      <div
        className="publisher-location-summary"
        role="status"
        aria-live="polite"
        data-testid="publisher-address-summary"
      >
        <p
          className="publisher-location-status publisher-location-status--success motion-success-flash"
          data-testid="publisher-location-status"
        >
          Location selected
        </p>
        <p className="mt-0.5 text-xs leading-5 text-muted">
          You can move the map to adjust the spot.
        </p>
      </div>
    );
  }

  return null;
}

function LocationStatus({
  geoStatus,
  hasLocation,
  pending,
  onRetry,
  onChooseOnMap,
}: {
  geoStatus: GeoStatus;
  hasLocation: boolean;
  pending: boolean;
  onRetry: () => void;
  onChooseOnMap: () => void;
}) {
  if (geoStatus === "error") {
    return (
      <div
        className="publisher-location-status"
        role="status"
        aria-live="polite"
        data-testid="location-unavailable"
      >
        <p className="font-medium text-foreground">Location unavailable</p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onRetry}
            disabled={pending}
            className="!min-h-[var(--app-tap-min)] !px-3 !py-2 text-xs"
          >
            Try again
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={onChooseOnMap}
            disabled={pending}
            className="!min-h-[var(--app-tap-min)] !px-3 !py-2 text-xs"
          >
            Choose on map
          </Button>
        </div>
      </div>
    );
  }

  if (geoStatus === "loading" && !hasLocation) {
    return null;
  }

  return null;
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

  const parsedLat = parseCoord(latitude);
  const parsedLng = parseCoord(longitude);
  const canRenderPicker =
    showMap && parsedLat !== null && parsedLng !== null;

  const {
    status: addressLookupStatus,
    label: addressLabel,
    addressForPublish,
    isUpdating,
    notifyMapMoveStart,
  } = useReverseGeocode(
    canRenderPicker ? parsedLat : null,
    canRenderPicker ? parsedLng : null,
    canRenderPicker,
  );

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

  return (
    <form
      action={formAction}
      className="publisher-compose mx-auto w-full max-w-lg motion-fade-slide-up md:max-w-xl"
      data-testid="publish-spot-form"
    >
      <div className="publisher-compose-surface">
        <section
          className="flex flex-col gap-2"
          aria-label="Parking location"
        >
          {geoStatus === "loading" && !canRenderPicker ? (
            <MapShellSkeleton message="Loading map…" />
          ) : null}

          {canRenderPicker ? (
            <SpotLocationPickerLoader
              latitude={parsedLat}
              longitude={parsedLng}
              onLocationChange={handleMapLocationChange}
              onMapInteractionStart={notifyMapMoveStart}
              disabled={pending}
              userLatitude={detectedLocation?.latitude ?? null}
              userLongitude={detectedLocation?.longitude ?? null}
            />
          ) : null}

          <LocationStatus
            geoStatus={geoStatus}
            hasLocation={hasLocation}
            pending={pending}
            onRetry={requestLocation}
            onChooseOnMap={chooseOnMap}
          />

          {hasLocation && geoStatus !== "error" ? (
            <AddressLookupSummary
              geoStatus={geoStatus}
              hasLocation={hasLocation}
              lookupStatus={addressLookupStatus}
              addressLabel={addressLabel}
              isUpdating={isUpdating}
            />
          ) : null}

          {!showManualCoords ? (
            <>
              <input type="hidden" name="latitude" value={latitude} />
              <input type="hidden" name="longitude" value={longitude} />
              <input
                type="hidden"
                name="address"
                value={addressForPublish ?? ""}
              />
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
                    inputMode="decimal"
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
                    inputMode="decimal"
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
            aria-busy={pending}
            className="publisher-share-cta"
          >
            {pending ? "Sharing…" : "Share spot"}
          </Button>
          <p className="text-xs leading-5 text-muted">
            This coordinates a handoff; it does not reserve the spot.
          </p>
        </div>
      </div>
    </form>
  );
}
