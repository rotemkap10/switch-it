"use client";

import {
  ParkingMapMapLibre,
  type PickerExternalRecenter,
} from "@/components/map/ParkingMapMapLibre";
import type { DeviceLocationFix } from "@/lib/map/request-current-device-location";
import {
  LEAVER_MAP_SHELL_FILL_CLASS,
  LEAVER_MAP_SHELL_HEIGHT_CLASS,
} from "@/lib/map/leaverMapShell";

export type { PickerExternalRecenter };

export type SpotLocationPickerProps = {
  latitude: number;
  longitude: number;
  onLocationChange: (latitude: number, longitude: number) => void;
  /** Fired when the user begins panning/zooming (before moveend). */
  onMapInteractionStart?: () => void;
  /** Fired when a user gesture ended without changing the pin coordinates. */
  onMapInteractionSettled?: () => void;
  /** Fired when the user intentionally moved the map (not GPS / recenter). */
  onUserMovedMap?: () => void;
  /** Fired immediately when the user taps "Current location" (before GPS resolves). */
  onCurrentLocationRequested?: () => void;
  disabled?: boolean;
  /** Kept for loader / form compatibility. The shared map owns the blue dot. */
  userLatitude?: number | null;
  userLongitude?: number | null;
  userAccuracy?: number | null;
  /** Called when recenter obtains a fresh device fix (updates parent cache). */
  onCurrentLocationResolved?: (fix: DeviceLocationFix) => void;
  /**
   * Explicit camera command from address search. Map-originated moveend
   * updates must not increment this id.
   */
  externalRecenter?: PickerExternalRecenter | null;
  /**
   * `card` — fixed-height inset map (legacy / transition shell).
   * `fill` — absolute fill for the map-first Share a Spot compose screen.
   */
  layout?: "card" | "fill";
};

export {
  LEAVER_MAP_SHELL_FILL_CLASS,
  LEAVER_MAP_SHELL_HEIGHT_CLASS,
} from "@/lib/map/leaverMapShell";

/**
 * Share a Spot location picker.
 *
 * Thin shell around the same ParkingMapMapLibre implementation as Find
 * Parking. No independent MapLibre init or gesture physics.
 */
export function SpotLocationPickerMapLibre({
  onLocationChange,
  onMapInteractionStart,
  onMapInteractionSettled,
  onUserMovedMap,
  onCurrentLocationRequested,
  onCurrentLocationResolved,
  disabled = false,
  externalRecenter = null,
  layout = "card",
}: SpotLocationPickerProps) {
  const fill = layout === "fill";

  return (
    <div
      className={[
        "relative w-full overflow-hidden",
        fill
          ? LEAVER_MAP_SHELL_FILL_CLASS
          : [
              "rounded-[var(--radius-card)] border border-border",
              LEAVER_MAP_SHELL_HEIGHT_CLASS,
            ].join(" "),
        disabled ? "pointer-events-none" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Map to adjust your parking spot location"
      data-testid="leaver-map-picker"
      data-layout={fill ? "fill" : "card"}
    >
      <ParkingMapMapLibre
        mode="picker"
        spots={[]}
        destination={null}
        showDiscoveryCarousel={false}
        pickerDisabled={disabled}
        pickerLayout={fill ? "fullscreen" : "card"}
        onPickerLocationChange={onLocationChange}
        onPickerInteractionStart={onMapInteractionStart}
        onPickerInteractionSettled={onMapInteractionSettled}
        onPickerUserMovedMap={onUserMovedMap}
        onPickerCurrentLocationRequested={onCurrentLocationRequested}
        onPickerCurrentLocationResolved={onCurrentLocationResolved}
        pickerExternalRecenter={externalRecenter}
      />
    </div>
  );
}

/** Adapter export — loader / rollback switch by import path only. */
export function SpotLocationPicker(props: SpotLocationPickerProps) {
  return <SpotLocationPickerMapLibre {...props} />;
}
