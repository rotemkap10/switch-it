import { MapRouteLoadingChrome } from "@/components/map/MapRouteTransitionShell";

/** Map-first compose — match final shell geometry before MapLibre paints. */
export default function SpotsNewLoading() {
  return <MapRouteLoadingChrome mode="publisher" layout="map" />;
}
