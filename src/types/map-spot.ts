export type MapSpot = {
  id: string;
  latitude: number;
  longitude: number;
  address: string | null;
  available_at: string;
  expires_at: string;
  /** Set when the live Now-style window has already started. */
  handoff_started_at?: string | null;
  /** True when the signed-in user may claim this spot (not their own). */
  canClaim: boolean;
};

export const MAP_DEFAULT_CENTER = {
  lat: 32.0853,
  lng: 34.7818,
} as const;

export const MAP_DEFAULT_ZOOM = 14;
export const MAP_SINGLE_SPOT_ZOOM = 16;
