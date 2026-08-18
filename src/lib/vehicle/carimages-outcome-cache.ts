import {
  carImagesWidthForSize,
  type VehicleImageSize,
} from "@/lib/vehicle/carimages";

export type CarImagesOutcome =
  | { status: "ready"; src: string }
  | { status: "fallback" };

const outcomes = new Map<string, CarImagesOutcome>();

export function carImagesOutcomeKey(
  make: string,
  model: string,
  year: string | undefined,
  size: VehicleImageSize,
): string {
  return `${make}\0${model}\0${year ?? ""}\0${carImagesWidthForSize(size)}`;
}

export function peekCarImagesOutcome(
  key: string,
): CarImagesOutcome | undefined {
  return outcomes.get(key);
}

export function rememberCarImagesOutcome(
  key: string,
  outcome: CarImagesOutcome,
): void {
  outcomes.set(key, outcome);
}

export function forgetCarImagesOutcome(key: string): void {
  outcomes.delete(key);
}

export function resetCarImagesOutcomeCacheForTests(): void {
  outcomes.clear();
}
