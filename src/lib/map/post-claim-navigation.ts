/**
 * One-time in-memory handoff: successful Claim → open navigation chooser.
 *
 * Module bus + React provider. Survives ClaimSpotButton unmount / `/map`
 * revalidation in the same JS session. Not written to DB, localStorage,
 * sessionStorage, or the URL.
 */

import { isValidNavigationCoords } from "@/lib/map/navigation-urls";

export type PostClaimNavigationOffer = {
  claimId: string;
  latitude: number;
  longitude: number;
};

export type PostClaimNavigationSource = "post-claim" | "manual";

type Listener = (offer: PostClaimNavigationOffer) => void;

const listeners = new Set<Listener>();
let pendingOffer: PostClaimNavigationOffer | null = null;
const destinationsBySpotId = new Map<
  string,
  { latitude: number; longitude: number }
>();

export function logPostClaimNavigationDev(event: string): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  console.info(`[switch-it:nav] ${event}`);
}

export function subscribePostClaimNavigation(listener: Listener): () => void {
  listeners.add(listener);
  if (pendingOffer) {
    const queued = pendingOffer;
    pendingOffer = null;
    listener(queued);
  }
  return () => {
    listeners.delete(listener);
  };
}

export function offerPostClaimNavigation(
  offer: PostClaimNavigationOffer,
): void {
  logPostClaimNavigationDev("offerPostClaimNavigation called");
  if (!isValidNavigationCoords(offer.latitude, offer.longitude)) {
    logPostClaimNavigationDev("offer ignored — invalid coordinates");
    return;
  }
  if (listeners.size === 0) {
    pendingOffer = offer;
    return;
  }
  pendingOffer = null;
  for (const listener of listeners) {
    listener(offer);
  }
}

export function registerClaimSpotDestination(
  spotId: string,
  latitude: number,
  longitude: number,
): void {
  destinationsBySpotId.set(spotId, { latitude, longitude });
}

export function unregisterClaimSpotDestination(spotId: string): void {
  destinationsBySpotId.delete(spotId);
}

export function takeClaimSpotDestination(
  spotId: string,
): { latitude: number; longitude: number } | null {
  return destinationsBySpotId.get(spotId) ?? null;
}

export function peekPostClaimNavigationPendingForTests(): PostClaimNavigationOffer | null {
  return pendingOffer;
}

export function resetPostClaimNavigationForTests(): void {
  pendingOffer = null;
  listeners.clear();
  destinationsBySpotId.clear();
}
