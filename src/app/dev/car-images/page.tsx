import type { Metadata } from "next";

import { CarImagesDevGrid } from "@/app/dev/car-images/CarImagesDevGrid";

export const metadata: Metadata = {
  title: "CarImages PoC",
  robots: { index: false, follow: false },
};

export default function CarImagesDevPage() {
  return <CarImagesDevGrid />;
}
