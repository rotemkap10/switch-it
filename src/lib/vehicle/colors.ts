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

/** Fill hex for local SVG illustrations (controlled palette only). */
export const VEHICLE_COLOR_FILL: Record<VehicleColor, string> = {
  white: "#f7fbff",
  black: "#1f2933",
  gray: "#8b9aab",
  silver: "#c5d0db",
  blue: "#3b82c4",
  red: "#d45b5b",
  green: "#4f9b6e",
  yellow: "#e2c04c",
  brown: "#8b5e3c",
  beige: "#d8c3a5",
  other: "#55bff3",
};

export function isVehicleColor(value: string): value is VehicleColor {
  return (VEHICLE_COLORS as readonly string[]).includes(value);
}
