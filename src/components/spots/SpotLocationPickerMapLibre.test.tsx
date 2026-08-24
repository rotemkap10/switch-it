import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/map/ParkingMapMapLibre", () => ({
  ParkingMapMapLibre: (props: {
    mode?: string;
    pickerDisabled?: boolean;
    pickerExternalRecenter?: unknown;
    pickerLayout?: string;
  }) => (
    <div
      data-testid="parking-map-stage"
      data-map-mode={props.mode}
      data-picker-disabled={String(Boolean(props.pickerDisabled))}
      data-has-external-recenter={String(Boolean(props.pickerExternalRecenter))}
      data-picker-layout={props.pickerLayout ?? "card"}
    />
  ),
  PARKING_MAP_BASEMAP_CLASS: "absolute inset-0 h-full w-full",
}));

import { SpotLocationPickerMapLibre } from "@/components/spots/SpotLocationPickerMapLibre";

describe("SpotLocationPickerMapLibre", () => {
  it("is a thin shell around ParkingMapMapLibre picker mode", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/spots/SpotLocationPickerMapLibre.tsx"),
      "utf8",
    );
    expect(source).toContain('mode="picker"');
    expect(source).toContain("ParkingMapMapLibre");
    expect(source).not.toMatch(/\bdragPan\b/);
    expect(source).not.toContain("from \"maplibre-gl\"");
    expect(source).not.toContain("from 'maplibre-gl'");
  });

  it("keeps the leaver shell height and disables via pointer-events", () => {
    const { rerender } = render(
      <SpotLocationPickerMapLibre
        latitude={32.085312}
        longitude={34.781812}
        onLocationChange={vi.fn()}
      />,
    );

    const picker = screen.getByTestId("leaver-map-picker");
    expect(picker.className).toContain("leaver-map-picker-shell");
    expect(picker.className).not.toContain("leaver-map-picker-shell--fill");
    expect(picker).toHaveAttribute("data-layout", "card");
    expect(picker.className).not.toContain("pointer-events-none");
    expect(picker.className).not.toContain("touch-none");
    expect(screen.getByTestId("parking-map-stage")).toHaveAttribute(
      "data-map-mode",
      "picker",
    );

    rerender(
      <SpotLocationPickerMapLibre
        latitude={32.085312}
        longitude={34.781812}
        onLocationChange={vi.fn()}
        disabled
      />,
    );
    expect(screen.getByTestId("leaver-map-picker").className).toContain(
      "pointer-events-none",
    );
    expect(screen.getByTestId("parking-map-stage")).toHaveAttribute(
      "data-picker-disabled",
      "true",
    );
  });

  it("fill layout uses the fullscreen picker chrome", () => {
    render(
      <SpotLocationPickerMapLibre
        latitude={32.085312}
        longitude={34.781812}
        onLocationChange={vi.fn()}
        layout="fill"
      />,
    );

    const picker = screen.getByTestId("leaver-map-picker");
    expect(picker.className).toContain("leaver-map-picker-shell--fill");
    expect(picker).toHaveAttribute("data-layout", "fill");
    expect(screen.getByTestId("parking-map-stage")).toHaveAttribute(
      "data-picker-layout",
      "fullscreen",
    );
  });

  it("forwards address-search recenter and seeds the picker from latitude/longitude", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/spots/SpotLocationPickerMapLibre.tsx"),
      "utf8",
    );
    expect(source).toContain("seedCenter={{ latitude, longitude }}");

    render(
      <SpotLocationPickerMapLibre
        latitude={32.085312}
        longitude={34.781812}
        onLocationChange={vi.fn()}
        externalRecenter={{
          requestId: 3,
          latitude: 32.26,
          longitude: 34.89,
        }}
      />,
    );
    expect(screen.getByTestId("parking-map-stage")).toHaveAttribute(
      "data-has-external-recenter",
      "true",
    );
  });
});
