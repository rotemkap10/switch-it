export type CarImagesTestVehicle = {
  make: string;
  model: string;
  year: number;
};

/** Temporary PoC combinations for the /dev/car-images helper. */
export const CARIMAGES_DEV_TEST_VEHICLES: readonly CarImagesTestVehicle[] = [
  { make: "Hyundai", model: "Tucson", year: 2025 },
  { make: "Toyota", model: "Corolla", year: 2024 },
  { make: "Kia", model: "Picanto", year: 2024 },
  { make: "Skoda", model: "Octavia", year: 2024 },
  { make: "Toyota", model: "Yaris", year: 2024 },
  { make: "Kia", model: "Niro", year: 2024 },
];
