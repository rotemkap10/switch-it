"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";

import {
  publishSpot,
  type PublishSpotActionState,
} from "@/actions/spots";
import { useActionFeedback } from "@/components/feedback/useActionFeedback";
import { LeaveTimeSlider } from "@/components/spots/LeaveTimeSlider";
import { SpotLocationPickerLoader } from "@/components/spots/SpotLocationPickerLoader";
import { Button } from "@/components/ui/Button";import { publisherSpotAddressLabel } from "@/lib/geocoding/location-display";
import { useReverseGeocode } from "@/lib/geocoding/use-reverse-geocode";
import type { DeviceLocationFix } from "@/lib/map/request-current-device-location";
import type { GeolocationReason } from "@/lib/map/use-user-location";
import {
  mapTilerForwardGeocodeSearch,
  type ForwardGeocodeResult,
} from "@/lib/geocoding/maptiler-forward-geocode";
import {
  acquireSharedForegroundLocation,
  peekTrustedSharedForegroundFix,
  subscribeSharedForegroundLocation,
} from "@/lib/map/shared-foreground-location";
import { classifyGpsAccuracy } from "@/lib/map/watch-best-device-location";
import { MAP_DEFAULT_CENTER } from "@/types/map-spot";

export const PUBLISHER_POOR_LOCATION_WARNING =
  "Your location may not be precise. Check that the pin is in the correct spot.";

const initialState: PublishSpotActionState = {};

type GeoStatus = "loading" | "success" | "error" | "manual";

function formatCoord(value: number): string {
  return value.toFixed(6);
}

function parseCoord(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isHebrewText(value: string): boolean {
  // Hebrew Unicode block: \u0590-\u05FF
  return /[\u0590-\u05FF]/.test(value);
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

function AddressLookupSummary({
  geoStatus,
  hasLocation,
  lookupStatus,
  addressLabel,
  isUpdating,
  accuracyMeters,
  pinPlacedManually,
  manualAddressLabel,
}: {
  geoStatus: GeoStatus;
  hasLocation: boolean;
  lookupStatus: "idle" | "loading" | "success" | "unavailable";
  addressLabel: string | null;
  isUpdating: boolean;
  accuracyMeters: number | null;
  pinPlacedManually: boolean;
  manualAddressLabel: string | null;
}) {
  if (geoStatus === "loading" && !pinPlacedManually) {
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

  const showPoorWarning =
    !pinPlacedManually && classifyGpsAccuracy(accuracyMeters) === "poor";

  const accuracyBlock = showPoorWarning ? (
    <p
      className="publisher-location-summary__warning"
      role="status"
      data-testid="publisher-location-accuracy-warning"
    >
      {PUBLISHER_POOR_LOCATION_WARNING}
    </p>
  ) : null;

  const showManualAddress =
    pinPlacedManually && Boolean(manualAddressLabel?.trim());
  if (showManualAddress) {
    const display = publisherSpotAddressLabel(manualAddressLabel);
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
          title={display ?? undefined}
        >
          {display}
        </p>
        {accuracyBlock}
      </div>
    );
  }

  const showResolved =
    lookupStatus === "success" && addressLabel && !isUpdating;
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

  // Do not show "Finding the address…" or fallbacks. Address is
  // display-only; publishing always uses marker coordinates.
  return accuracyBlock ? (
    <div
      className="publisher-location-summary"
      role="status"
      aria-live="polite"
      data-testid="publisher-address-summary"
    >
      {accuracyBlock}
    </div>
  ) : null;
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

  const [latitude, setLatitude] = useState(() =>
    formatCoord(MAP_DEFAULT_CENTER.lat),
  );
  const [longitude, setLongitude] = useState(() =>
    formatCoord(MAP_DEFAULT_CENTER.lng),
  );
  const [detectedLocation, setDetectedLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [leaveInMinutes, setLeaveInMinutes] = useState(0);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("loading");
  const [geoError, setGeoError] = useState<GeolocationReason | null>(null);
  const [accuracyMeters, setAccuracyMeters] = useState<number | null>(null);
  const [manualOverride, setManualOverride] = useState(false);
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const stopWatchRef = useRef<(() => void) | null>(null);
  const manualOverrideRef = useRef(false);
  const locationConfirmedRef = useRef(false);
  /** True while a user gesture paused GPS before we know if the pin moved. */
  const gesturePausedGpsRef = useRef(false);

  const [addressQuery, setAddressQuery] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<
    ForwardGeocodeResult[]
  >([]);
  const [addressSearchPending, setAddressSearchPending] = useState(false);
  const [manualAddressLabel, setManualAddressLabel] = useState<string | null>(
    null,
  );
  const [manualAddressLatLng, setManualAddressLatLng] = useState<{
    lat: string;
    lng: string;
  } | null>(null);

  const locationActionSeqRef = useRef(0);
  const gpsRequestSeqRef = useRef<number | null>(null);
  const forwardSearchSeqRef = useRef(0);

  const bumpLocationAction = useCallback(() => {
    locationActionSeqRef.current += 1;
    return locationActionSeqRef.current;
  }, []);

  const hasLocation = latitude !== "" && longitude !== "";
  const awaitingInitialGps = geoStatus === "loading" && !manualOverride;
  const manualAddressMatchesCoords =
    manualAddressLatLng != null &&
    manualAddressLatLng.lat === latitude &&
    manualAddressLatLng.lng === longitude;
  const parsedLat = parseCoord(latitude);
  const parsedLng = parseCoord(longitude);
  const canRenderPicker = parsedLat !== null && parsedLng !== null;

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

  const addressForPublishValue =
    manualAddressMatchesCoords && manualAddressLabel
      ? manualAddressLabel
      : addressForPublish ?? "";

  const setLocation = useCallback((lat: number, lng: number) => {
    setLatitude(formatCoord(lat));
    setLongitude(formatCoord(lng));
  }, []);

  // Debounced forward geocoding for address search (label-only).
  useEffect(() => {
    const scheduleReset = () => {
      const runner = () => {
        setAddressSuggestions([]);
        setAddressSearchPending(false);
      };

      if (typeof queueMicrotask === "function") {
        queueMicrotask(runner);
        return;
      }

      window.setTimeout(runner, 0);
    };

    if (!canRenderPicker) {
      scheduleReset();
      return;
    }

    const query = addressQuery.trim();
    if (query.length < 3) {
      scheduleReset();
      return;
    }

    const requestSeq = ++forwardSearchSeqRef.current;

    const centerLat = detectedLocation?.latitude ?? parsedLat;
    const centerLng = detectedLocation?.longitude ?? parsedLng;

    const id = window.setTimeout(() => {
      if (requestSeq !== forwardSearchSeqRef.current) {
        return;
      }

      setAddressSearchPending(true);

      if (!Number.isFinite(centerLat) || !Number.isFinite(centerLng)) {
        setAddressSuggestions([]);
        setAddressSearchPending(false);
        return;
      }

      void mapTilerForwardGeocodeSearch(query, {
        limit: 5,
        language: "he",
        country: "il",
        // Prefer results near the current map/region, but do not overly
        // constrain the search area (street search must work across IL).
        proximity: { lon: centerLng, lat: centerLat },
        types: ["address", "road", "locality", "place"],
        fuzzyMatch: true,
        autocomplete: true,
      })
        .then((results) => {
          if (requestSeq !== forwardSearchSeqRef.current) {
            return;
          }
          setAddressSuggestions(results);
          setAddressSearchPending(false);
        })
        .catch(() => {
          if (requestSeq !== forwardSearchSeqRef.current) {
            return;
          }
          setAddressSuggestions([]);
          setAddressSearchPending(false);
        });
    }, 350);

    return () => {
      window.clearTimeout(id);
    };
  }, [
    addressQuery,
    canRenderPicker,
    detectedLocation?.latitude,
    detectedLocation?.longitude,
    parsedLat,
    parsedLng,
  ]);

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
      // GPS-driven marker placement invalidates any prior manual address selection.
      setManualAddressLabel(null);
      setManualAddressLatLng(null);
      setLocation(fix.latitude, fix.longitude);
      setGeoError(null);
      setGeoStatus("success");
      setLocationConfirmed(true);
    },
    [setLocation],
  );
  const applyGpsFixRef = useRef(applyGpsFix);

  useEffect(() => {
    applyGpsFixRef.current = applyGpsFix;
  }, [applyGpsFix]);

  const subscribeGpsWatch = useCallback(() => {
    stopGpsWatch();
    const release = acquireSharedForegroundLocation("share-spot");
    const existing = peekTrustedSharedForegroundFix();
    if (existing && !manualOverrideRef.current) {
      applyGpsFixRef.current(existing);
    }

    const unsub = subscribeSharedForegroundLocation((snap) => {
      if (manualOverrideRef.current || gesturePausedGpsRef.current) {
        return;
      }
      if (snap.trustedFix) {
        applyGpsFixRef.current(snap.trustedFix);
        return;
      }
      if (snap.status === "error" && snap.error) {
        setGeoError(snap.error);
        setGeoStatus("error");
      }
    });

    stopWatchRef.current = () => {
      unsub();
      release();
    };
  }, [stopGpsWatch]);

  const startGpsWatch = useCallback(() => {
    setGeoError(null);
    setManualOverride(false);
    manualOverrideRef.current = false;
    gesturePausedGpsRef.current = false;
    setLocationConfirmed(false);
    setGeoStatus("loading");
    subscribeGpsWatch();
  }, [subscribeGpsWatch]);

  useEffect(() => {
    manualOverrideRef.current = manualOverride;
  }, [manualOverride]);

  useEffect(() => {
    locationConfirmedRef.current = locationConfirmed;
  }, [locationConfirmed]);

  useEffect(() => {
    subscribeGpsWatch();
    return () => {
      stopWatchRef.current?.();
      stopWatchRef.current = null;
    };
  }, [subscribeGpsWatch]);

  function handleCurrentLocationRequested() {
    const seq = bumpLocationAction();
    gpsRequestSeqRef.current = seq;
    setAddressQuery("");
    setAddressSuggestions([]);
    setAddressSearchPending(false);
    // Clear manual label immediately; the coordinates will come from GPS.
    setManualAddressLabel(null);
    setManualAddressLatLng(null);
  }

  function chooseOnMap() {
    bumpLocationAction();
    gpsRequestSeqRef.current = null;
    stopGpsWatch();
    gesturePausedGpsRef.current = false;
    setManualOverride(true);
    manualOverrideRef.current = true;
    setManualAddressLabel(null);
    setManualAddressLatLng(null);
    setAddressQuery("");
    setAddressSuggestions([]);
    setAccuracyMeters(null);
    if (!hasLocation) {
      setLocation(MAP_DEFAULT_CENTER.lat, MAP_DEFAULT_CENTER.lng);
    }
    setGeoStatus("manual");
    // Fallback is display-only until the user pans, picks an address, or
    // uses Current Location — do not confirm Tel Aviv for publish.
    setLocationConfirmed(false);
  }

  function handleMapLocationChange(lat: number, lng: number) {
    setLocation(lat, lng);
    if (geoStatus !== "manual") {
      setGeoStatus("success");
    }
  }

  function handleMapInteractionStart() {
    notifyMapMoveStart();
    // Soft-pause GPS during a gesture so a late fix cannot yank the pin mid-drag.
    // Do not set permanent manualOverride / locationConfirmed yet — a tiny touch
    // that does not change coordinates must not lock the Tel Aviv fallback.
    if (!manualOverrideRef.current) {
      gesturePausedGpsRef.current = true;
      stopGpsWatch();
    }
  }

  function handleMapInteractionSettled() {
    notifyMapMoveSettled();
    if (
      gesturePausedGpsRef.current &&
      !manualOverrideRef.current &&
      !locationConfirmedRef.current
    ) {
      gesturePausedGpsRef.current = false;
      setGeoStatus("loading");
      subscribeGpsWatch();
      return;
    }
    gesturePausedGpsRef.current = false;
  }

  function handleUserMovedMap() {
    bumpLocationAction();
    gpsRequestSeqRef.current = null;
    gesturePausedGpsRef.current = false;
    stopGpsWatch();
    setManualOverride(true);
    manualOverrideRef.current = true;
    setManualAddressLabel(null);
    setManualAddressLatLng(null);
    setAccuracyMeters(null);
    setLocationConfirmed(true);
  }

  function handleCurrentLocationResolved(fix: DeviceLocationFix) {
    const expectedSeq = gpsRequestSeqRef.current;
    if (expectedSeq == null || expectedSeq !== locationActionSeqRef.current) {
      return;
    }
    gpsRequestSeqRef.current = null;
    gesturePausedGpsRef.current = false;
    stopGpsWatch();
    setManualOverride(false);
    manualOverrideRef.current = false;
    applyGpsFix(fix);
  }

  function handleAddressSearchSelect(result: ForwardGeocodeResult) {
    bumpLocationAction();
    gpsRequestSeqRef.current = null;

    gesturePausedGpsRef.current = false;
    stopGpsWatch();
    setManualOverride(true);
    manualOverrideRef.current = true;
    setAccuracyMeters(null);
    setGeoStatus("manual");

    const latStr = formatCoord(result.latitude);
    const lngStr = formatCoord(result.longitude);
    setLatitude(latStr);
    setLongitude(lngStr);

    setManualAddressLabel(result.label);
    setManualAddressLatLng({ lat: latStr, lng: lngStr });

    setAddressQuery("");
    setAddressSuggestions([]);
    setAddressSearchPending(false);
    setLocationConfirmed(true);
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
          data-testid="parking-location-section"
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
            manualAddressLabel={manualAddressLabel}
          />

          {canRenderPicker ? (
            <div
              className="flex flex-col gap-2"
              data-testid="publish-spot-address-search"
            >
              <label htmlFor="address-search" className="sr-only">
                Search an address
              </label>
              <input
                id="address-search"
                type="text"
                inputMode="search"
                placeholder="Search an address"
                value={addressQuery}
                onChange={(e) => setAddressQuery(e.target.value)}
                disabled={pending}
                aria-busy={addressSearchPending || undefined}
                className="app-form-control min-h-[var(--app-tap-min)] rounded-[var(--radius-card)] border border-border bg-surface px-3 py-2 text-foreground placeholder:text-muted/70 disabled:opacity-60"
                dir={isHebrewText(addressQuery) ? "rtl" : "ltr"}
                aria-autocomplete="list"
              />

              {addressSuggestions.length > 0 ? (
                <ul
                  className="max-h-44 overflow-auto rounded-[var(--radius-card)] border border-border bg-surface p-1"
                  role="listbox"
                  dir={addressSuggestions[0] && isHebrewText(addressSuggestions[0].label) ? "rtl" : "ltr"}
                >
                  {addressSuggestions.map((s, idx) => (
                    <li key={`${s.label}-${idx}`}>
                      <button
                        type="button"
                        className="block w-full rounded-[var(--radius-card)] px-3 py-2 text-left text-sm text-foreground hover:bg-accent-soft"
                        onClick={() => handleAddressSearchSelect(s)}
                      >
                        {s.label}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <LocationStatus
            geoStatus={geoStatus}
            geoError={geoError}
            pending={pending}
            onRetry={startGpsWatch}
            onChooseOnMap={chooseOnMap}
          />

          {canRenderPicker ? (
            <div data-testid="publish-spot-map-section">
              <SpotLocationPickerLoader
                latitude={parsedLat}
                longitude={parsedLng}
                onLocationChange={handleMapLocationChange}
                onMapInteractionStart={handleMapInteractionStart}
                onMapInteractionSettled={handleMapInteractionSettled}
                onUserMovedMap={handleUserMovedMap}
                onCurrentLocationRequested={handleCurrentLocationRequested}
                disabled={pending}
                userLatitude={detectedLocation?.latitude ?? null}
                userLongitude={detectedLocation?.longitude ?? null}
                userAccuracy={accuracyMeters}
                onCurrentLocationResolved={handleCurrentLocationResolved}
              />
            </div>
          ) : null}

          <input
            type="hidden"
            name="latitude"
            value={locationConfirmed ? latitude : ""}
          />
          <input
            type="hidden"
            name="longitude"
            value={locationConfirmed ? longitude : ""}
          />
          <input type="hidden" name="address" value={addressForPublishValue} />
          <input
            type="hidden"
            name="available_in_minutes"
            value={String(leaveInMinutes)}
          />

          {state.fieldErrors?.latitude?.[0] ? (
            <p className="text-sm text-danger" role="alert">
              {state.fieldErrors.latitude[0]}
            </p>
          ) : null}
          {state.fieldErrors?.longitude?.[0] ? (
            <p className="text-sm text-danger" role="alert">
              {state.fieldErrors.longitude[0]}
            </p>
          ) : null}
        </section>

        <section aria-labelledby="leave-time-label" data-testid="leave-time-section">
          <LeaveTimeSlider
            value={leaveInMinutes}
            onChange={setLeaveInMinutes}
            disabled={pending}
            error={state.fieldErrors?.available_in_minutes?.[0]}
          />
        </section>

        <div className="flex flex-col gap-2" data-testid="publish-spot-actions">
          <Button
            type="submit"
            disabled={pending || !locationConfirmed || awaitingInitialGps}
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
