/**
 * Cross-component bus so claim failures can tombstone a stale discovery marker
 * without prop-drilling through the map tree.
 */

type DiscoverySpotListener = (spotId: string) => void;

const listeners = new Set<DiscoverySpotListener>();

export function subscribeDiscoverySpotTombstone(
  listener: DiscoverySpotListener,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function requestDiscoverySpotTombstone(spotId: string): void {
  if (!spotId) {
    return;
  }
  for (const listener of listeners) {
    listener(spotId);
  }
}
