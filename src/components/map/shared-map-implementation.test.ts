import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Find Parking and Share a Spot share one map implementation", () => {
  const parkingMap = readFileSync(
    resolve(process.cwd(), "src/components/map/ParkingMapMapLibre.tsx"),
    "utf8",
  );
  const picker = readFileSync(
    resolve(process.cwd(), "src/components/spots/SpotLocationPickerMapLibre.tsx"),
    "utf8",
  );
  const loader = readFileSync(
    resolve(process.cwd(), "src/components/map/ParkingMapLoader.tsx"),
    "utf8",
  );
  const form = readFileSync(
    resolve(process.cwd(), "src/components/spots/PublishSpotForm.tsx"),
    "utf8",
  );
  const baseMap = readFileSync(
    resolve(process.cwd(), "src/components/map/BaseMap.tsx"),
    "utf8",
  );
  const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

  it("Find Parking loads ParkingMapMapLibre in browse mode", () => {
    expect(loader).toContain("ParkingMapMapLibre");
    expect(loader).toContain('mode="browse"');
  });

  it("Share a Spot renders ParkingMapMapLibre in picker mode", () => {
    expect(picker).toContain("ParkingMapMapLibre");
    expect(picker).toContain('mode="picker"');
    expect(form).toContain("SpotLocationPickerLoader");
  });

  it("Share has no independent MapLibre or dragPan initialization", () => {
    expect(picker).not.toContain("BaseMap");
    expect(picker).not.toMatch(/\bdragPan\b/);
    expect(picker).not.toContain("dragstart");
    expect(picker).not.toContain("touchstart");
    expect(picker).not.toContain("touchmove");
    expect(picker).not.toContain("touchend");
    expect(picker).not.toContain("inertia");
    expect(picker).not.toContain("jumpTo");
    expect(picker).not.toContain("easeTo");
    expect(picker).not.toContain("flyTo");
    expect(picker).not.toContain("setCenter");
    expect(picker).not.toContain("NavigationControl");
  });

  it("Share form does not implement map gesture physics", () => {
    expect(form).not.toContain("dragPan");
    expect(form).not.toContain("touch-action");
    expect(form).not.toContain("overscroll");
  });

  it("the interactive MapLibre surface class is shared", () => {
    expect(parkingMap).toContain(
      'export const PARKING_MAP_BASEMAP_CLASS = "absolute inset-0 h-full w-full"',
    );
    expect(parkingMap).toContain("PARKING_MAP_BASEMAP_CLASS");
    expect(baseMap).toContain("touch-none");
    expect(baseMap).toContain("map-canvas-fade");
  });

  it("Share shell height does not steal touch-action from the map canvas", () => {
    const shell = css.match(/\.leaver-map-picker-shell\s*\{[^}]+\}/)?.[0];
    expect(shell).toBeTruthy();
    expect(shell).toContain("clamp(280px, 48dvh, 400px)");
    expect(shell).not.toContain("touch-action");
    expect(shell).not.toContain("overscroll-behavior");

    const compose = css.match(/\.publisher-compose\s*\{[^}]+\}/)?.[0];
    expect(compose).toBeTruthy();
    expect(compose).not.toContain("touch-action");
  });
});
