import { sanitizeLocationLabel } from "@/lib/geocoding/sanitize-location-label";

export const SEEKER_SPOT_ADDRESS_FALLBACK = "Parking spot on the map";

export const PUBLISHER_SPOT_ADDRESS_FALLBACK = "Location selected on the map";

export function seekerSpotAddressLabel(
  address: string | null | undefined,
): string {
  return sanitizeLocationLabel(address) ?? SEEKER_SPOT_ADDRESS_FALLBACK;
}

export function publisherSpotAddressLabel(
  address: string | null | undefined,
): string {
  return sanitizeLocationLabel(address) ?? PUBLISHER_SPOT_ADDRESS_FALLBACK;
}
