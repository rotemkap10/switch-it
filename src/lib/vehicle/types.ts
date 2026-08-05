export const VEHICLE_TYPES = [
  "mini",
  "hatchback",
  "sedan",
  "suv",
  "pickup",
  "van",
  "other",
] as const;

export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  mini: "Mini",
  hatchback: "Hatchback",
  sedan: "Sedan",
  suv: "SUV",
  pickup: "Pickup",
  van: "Van",
  other: "Other",
};

export function isVehicleType(value: string): value is VehicleType {
  return (VEHICLE_TYPES as readonly string[]).includes(value);
}
