import { seekerSpotAddressLabel } from "@/lib/geocoding/location-display";
import type { MapSpot } from "@/types/map-spot";

/** Minute-level availability copy for discovery cards (not a live second countdown). */
export function formatSpotAvailabilityLabel(
  availableAt: string,
  now = Date.now(),
): string {
  const target = new Date(availableAt).getTime();
  if (Number.isNaN(target) || target <= now) {
    return "Available now";
  }

  const minutes = Math.max(1, Math.round((target - now) / 60_000));
  return `Available in ${minutes} min`;
}

export function isSpotStillListed(
  spot: Pick<MapSpot, "expires_at">,
  now = Date.now(),
): boolean {
  const expiresAt = new Date(spot.expires_at).getTime();
  return !Number.isNaN(expiresAt) && expiresAt > now;
}

export function spotCarouselAddressLabel(
  address: string | null | undefined,
): string {
  return seekerSpotAddressLabel(address);
}
