export type MapSpot = {
  id: string;
  latitude: number;
  longitude: number;
  address: string | null;
  available_at: string;
  expires_at: string;
  /** True when the signed-in user may claim this spot (not their own). */
  canClaim: boolean;
};

export const MAP_DEFAULT_CENTER = {
  lat: 32.167,
  lng: 34.843,
} as const;

export const MAP_DEFAULT_ZOOM = 14;
export const MAP_SINGLE_SPOT_ZOOM = 16;
