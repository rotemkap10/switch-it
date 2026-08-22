export const VEHICLE_COLORS = [
  "white",
  "black",
  "gray",
  "silver",
  "blue",
  "red",
  "green",
  "yellow",
  "brown",
  "beige",
  "other",
] as const;

export type VehicleColor = (typeof VEHICLE_COLORS)[number];

export const VEHICLE_COLOR_LABELS: Record<VehicleColor, string> = {
  white: "White",
  black: "Black",
  gray: "Gray",
  silver: "Silver",
  blue: "Blue",
  red: "Red",
  green: "Green",
  yellow: "Yellow",
  brown: "Brown",
  beige: "Beige",
  other: "Other",
};

/** Stored vehicle color labels — illustrations always use the strict brand palette. */

export function isVehicleColor(value: string): value is VehicleColor {
  return (VEHICLE_COLORS as readonly string[]).includes(value);
}
