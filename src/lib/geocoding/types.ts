export type ReverseGeocodeInput = {
  latitude: number;
  longitude: number;
};

export type ReverseGeocodeResult = {
  label: string | null;
};

/** Provider-neutral parts used to build a concise parking label. */
export type LocationLabelParts = {
  street?: string | null;
  houseNumber?: string | null;
  namedPlace?: string | null;
  neighborhood?: string | null;
  city?: string | null;
};

export type ReverseGeocodeLookupStatus =
  | "idle"
  | "loading"
  | "success"
  | "unavailable";
