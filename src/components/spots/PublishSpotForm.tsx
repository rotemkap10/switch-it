"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";

import {
  publishSpot,
  type PublishSpotActionState,
} from "@/actions/spots";
import { useActionFeedback } from "@/components/feedback/useActionFeedback";
import { MapLoadingState } from "@/components/map/MapLoadingState";
import { LeaveTimeSlider } from "@/components/spots/LeaveTimeSlider";
import { SpotLocationPickerLoader } from "@/components/spots/SpotLocationPickerLoader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PUBLISHER_SPOT_ADDRESS_FALLBACK } from "@/lib/geocoding/location-display";
import { useReverseGeocode } from "@/lib/geocoding/use-reverse-geocode";
import { LEAVER_MAP_SHELL_HEIGHT_CLASS } from "@/lib/map/leaverMapShell";
import type { DeviceLocationFix } from "@/lib/map/request-current-device-location";
import type { GeolocationReason } from "@/lib/map/use-user-location";
import {
  classifyGpsAccuracy,
  formatGpsAccuracyLabel,
  watchBestDeviceLocation,
} from "@/lib/map/watch-best-device-location";
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

function locationErrorCopy(reason: GeolocationReason | null): string {
  switch (reason) {
    case "denied":
      return "Location permission denied. Place the pin on the map yourself.";
    case "timeout":
      return "GPS timed out. Try again or place the pin on the map.";
    default:
      return "Location unavailable. Place the pin on the map yourself.";
  }
}

function MapShellSkeleton({ message }: { message: string }) {
  return (
    <div
      className={[
        "overflow-hidden rounded-[var(--radius-card)] border border-border",
        LEAVER_MAP_SHELL_HEIGHT_CLASS,
      ].join(" ")}
      aria-label="Map to adjust your parking spot location"
    >
      <MapLoadingState className="h-full min-h-[inherit]" />
      <span className="sr-only">{message}</span>
    </div>
  );
}

function AddressLookupSummary({
  geoStatus,
  hasLocation,
  lookupStatus,
  addressLabel,
  isUpdating,
  accuracyMeters,
  pinPlacedManually,
}: {
  geoStatus: GeoStatus;
  hasLocation: boolean;
  lookupStatus: "idle" | "loading" | "success" | "unavailable";
  addressLabel: string | null;
  isUpdating: boolean;
  accuracyMeters: number | null;
  pinPlacedManually: boolean;
}) {
  if (geoStatus === "loading" && !hasLocation) {
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
  const showFallback =
    lookupStatus === "unavailable" ||
    (lookupStatus === "success" && !addressLabel && !isUpdating) ||
    (lookupStatus === "idle" && !addressLabel && !isUpdating);

  const accuracyLabel = pinPlacedManually
    ? null
    : formatGpsAccuracyLabel(accuracyMeters);
  const accuracyBand = pinPlacedManually
    ? "unknown"
    : classifyGpsAccuracy(accuracyMeters);
  const showPoorWarning = accuracyBand === "poor";

  const accuracyBlock =
    accuracyLabel || showPoorWarning ? (
      <>
        {accuracyLabel ? (
          <p
            className={[
              "publisher-location-summary__accuracy",
              accuracyBand === "poor"
                ? "publisher-location-summary__accuracy--poor"
                : "",
            ].join(" ")}
            data-testid="publisher-location-accuracy"
          >
            {accuracyLabel}
          </p>
        ) : null}
        {showPoorWarning ? (
          <p
            className="publisher-location-summary__warning"
            role="status"
            data-testid="publisher-location-accuracy-warning"
          >
            Location accuracy is low. Wait a moment for a better GPS signal or
            move the pin to the exact parking spot.
          </p>
        ) : null}
      </>
    ) : null;

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
          <p
            className="publisher-location-status publisher-location-status--success"
            data-testid="publisher-location-status"
          >
            {PUBLISHER_SPOT_ADDRESS_FALLBACK}
          </p>
        )}
        <p className="publisher-location-summary__loading motion-location-indicator">
          Finding the address…
        </p>
        {accuracyBlock}
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
        <p
          className="publisher-location-summary__value"
          data-testid="publisher-address-label"
          title={addressLabel ?? undefined}
        >
          {addressLabel}
        </p>
        {accuracyBlock}
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
        {accuracyBlock}
      </div>
    );
  }

  return null;
}

function LocationStatus({
  geoStatus,
  geoError,
  pending,
  onRetry,
  onChooseOnMap,
}: {
  geoStatus: GeoStatus;
  geoError: GeolocationReason | null;
  pending: boolean;
  onRetry: () => void;
  onChooseOnMap: () => void;
}) {
  if (geoStatus !== "error") {
    return null;
  }

  return (
    <div
      className="publisher-location-status"
      role="status"
      aria-live="polite"
      data-testid="location-unavailable"
    >
      <p className="font-medium text-foreground">
        {locationErrorCopy(geoError)}
      </p>
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
  const [leaveInMinutes, setLeaveInMinutes] = useState(0);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("loading");
  const [geoError, setGeoError] = useState<GeolocationReason | null>(null);
  const [accuracyMeters, setAccuracyMeters] = useState<number | null>(null);
  const [manualOverride, setManualOverride] = useState(false);
  const [showManualCoords, setShowManualCoords] = useState(false);
  const stopWatchRef = useRef<(() => void) | null>(null);
  const manualOverrideRef = useRef(false);
  const hasLocationRef = useRef(false);

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
    notifyMapMoveSettled,
  } = useReverseGeocode(
    canRenderPicker ? parsedLat : null,
    canRenderPicker ? parsedLng : null,
    canRenderPicker,
  );

  const setLocation = useCallback((lat: number, lng: number) => {
    setLatitude(formatCoord(lat));
    setLongitude(formatCoord(lng));
  }, []);

  const stopGpsWatch = useCallback(() => {
    stopWatchRef.current?.();
    stopWatchRef.current = null;
  }, []);

  const applyGpsFix = useCallback(
    (fix: DeviceLocationFix) => {
      setDetectedLocation({
        latitude: fix.latitude,
        longitude: fix.longitude,
      });
      setAccuracyMeters(fix.accuracy);
      setLocation(fix.latitude, fix.longitude);
      setGeoError(null);
      setGeoStatus("success");
    },
    [setLocation],
  );
  const applyGpsFixRef = useRef(applyGpsFix);

  useEffect(() => {
    applyGpsFixRef.current = applyGpsFix;
  }, [applyGpsFix]);

  const subscribeGpsWatch = useCallback(() => {
    stopGpsWatch();
    stopWatchRef.current = watchBestDeviceLocation({
      onUpdate: (fix) => {
        if (manualOverrideRef.current) {
          return;
        }
        applyGpsFixRef.current(fix);
      },
      onError: (reason) => {
        if (manualOverrideRef.current) {
          return;
        }
        if (hasLocationRef.current) {
          return;
        }
        setGeoError(reason);
        setGeoStatus("error");
      },
    });
  }, [stopGpsWatch]);

  const startGpsWatch = useCallback(() => {
    setGeoError(null);
    setManualOverride(false);
    manualOverrideRef.current = false;
    if (!hasLocationRef.current) {
      setGeoStatus("loading");
    }
    subscribeGpsWatch();
  }, [subscribeGpsWatch]);

  useEffect(() => {
    hasLocationRef.current = hasLocation;
  }, [hasLocation]);

  useEffect(() => {
    manualOverrideRef.current = manualOverride;
  }, [manualOverride]);

  useEffect(() => {
    subscribeGpsWatch();
    return () => {
      stopWatchRef.current?.();
      stopWatchRef.current = null;
    };
  }, [subscribeGpsWatch]);

  function chooseOnMap() {
    stopGpsWatch();
    setManualOverride(true);
    manualOverrideRef.current = true;
    setAccuracyMeters(null);
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

  function handleUserMovedMap() {
    stopGpsWatch();
    setManualOverride(true);
    manualOverrideRef.current = true;
    setAccuracyMeters(null);
  }

  function handleCurrentLocationResolved(fix: DeviceLocationFix) {
    stopGpsWatch();
    setManualOverride(false);
    manualOverrideRef.current = false;
    applyGpsFix(fix);
  }

  function handleManualCoordChange(
    setter: (value: string) => void,
    value: string,
  ) {
    stopGpsWatch();
    setManualOverride(true);
    manualOverrideRef.current = true;
    setAccuracyMeters(null);
    setter(value);
  }

  return (
    <form
      action={formAction}
      className="publisher-compose mx-auto w-full max-w-lg motion-fade-slide-up md:max-w-xl"
      data-testid="publish-spot-form"
    >
      <div className="publisher-compose-surface">
        <section
          className="flex flex-col gap-3"
          aria-label="Parking spot location"
        >
          <p className="text-sm font-medium text-foreground">
            Parking spot location
          </p>

          <AddressLookupSummary
            geoStatus={geoStatus}
            hasLocation={hasLocation}
            lookupStatus={addressLookupStatus}
            addressLabel={addressLabel}
            isUpdating={isUpdating}
            accuracyMeters={accuracyMeters}
            pinPlacedManually={manualOverride || geoStatus === "manual"}
          />

          {geoStatus === "loading" && !canRenderPicker ? (
            <MapShellSkeleton message="Loading map…" />
          ) : null}

          {canRenderPicker ? (
            <SpotLocationPickerLoader
              latitude={parsedLat}
              longitude={parsedLng}
              onLocationChange={handleMapLocationChange}
              onMapInteractionStart={notifyMapMoveStart}
              onMapInteractionSettled={notifyMapMoveSettled}
              onUserMovedMap={handleUserMovedMap}
              disabled={pending}
              userLatitude={detectedLocation?.latitude ?? null}
              userLongitude={detectedLocation?.longitude ?? null}
              onCurrentLocationResolved={handleCurrentLocationResolved}
            />
          ) : null}

          {canRenderPicker ? (
            <p
              className="publisher-pin-hint"
              data-testid="publisher-pin-hint"
            >
              Drag the pin if needed to mark the exact parking spot.
            </p>
          ) : null}

          <LocationStatus
            geoStatus={geoStatus}
            geoError={geoError}
            pending={pending}
            onRetry={startGpsWatch}
            onChooseOnMap={chooseOnMap}
          />

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
                    onChange={(event) =>
                      handleManualCoordChange(setLatitude, event.target.value)
                    }
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
                    onChange={(event) =>
                      handleManualCoordChange(setLongitude, event.target.value)
                    }
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
          <LeaveTimeSlider
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
        </div>
      </div>
    </form>
  );
}
