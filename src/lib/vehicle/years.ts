import { formatCanonicalMakeModelYear } from "@/lib/vehicle/catalog";

export const MIN_VEHICLE_YEAR = 1990;

/** Newest selectable model year: current calendar year plus one. */
export function maxVehicleYear(now: Date = new Date()): number {
  return now.getFullYear() + 1;
}

export function isVehicleYear(
  value: unknown,
  now: Date = new Date(),
): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_VEHICLE_YEAR &&
    value <= maxVehicleYear(now)
  );
}

export function coerceVehicleYear(
  value: unknown,
  now: Date = new Date(),
): number | null {
  if (isVehicleYear(value, now)) {
    return value;
  }
  if (typeof value === "string" && /^\d{4}$/.test(value.trim())) {
    const year = Number(value.trim());
    return isVehicleYear(year, now) ? year : null;
  }
  return null;
}

export function vehicleYearSelectOptions(
  now: Date = new Date(),
): { value: string; label: string }[] {
  const max = maxVehicleYear(now);
  const options: { value: string; label: string }[] = [];
  for (let year = max; year >= MIN_VEHICLE_YEAR; year -= 1) {
    options.push({ value: String(year), label: String(year) });
  }
  return options;
}

export function formatMakeModelYear(
  make: string,
  model: string,
  year?: number | null,
): string {
  return formatCanonicalMakeModelYear(make, model, year);
}
