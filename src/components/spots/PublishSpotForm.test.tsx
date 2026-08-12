import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FeedbackShell } from "@/components/feedback/FeedbackShell";
import {
  PUBLISHER_POOR_LOCATION_WARNING,
  PublishSpotForm,
} from "@/components/spots/PublishSpotForm";
import { publishSpotSchema } from "@/lib/validations/spot";
import { MAP_DEFAULT_CENTER } from "@/types/map-spot";

const { publishSpotMock } = vi.hoisted(() => ({
  publishSpotMock: vi.fn(),
}));

const { mapTilerForwardGeocodeSearchMock } = vi.hoisted(() => ({
  mapTilerForwardGeocodeSearchMock: vi.fn(),
}));

vi.mock("@/actions/spots", () => ({
  publishSpot: publishSpotMock,
}));

const reverseGeocodeState = vi.hoisted(() => ({
  status: "idle" as "idle" | "loading" | "success" | "unavailable",
  label: null as string | null,
  addressForPublish: null as string | null,
  isUpdating: false,
  notifyMapMoveStart: vi.fn(),
  notifyMapMoveSettled: vi.fn(),
}));

vi.mock("@/lib/geocoding/use-reverse-geocode", () => ({
  useReverseGeocode: () => ({
    status: reverseGeocodeState.status,
    label: reverseGeocodeState.label,
    addressForPublish: reverseGeocodeState.addressForPublish,
    isUpdating: reverseGeocodeState.isUpdating,
    notifyMapMoveStart: reverseGeocodeState.notifyMapMoveStart,
    notifyMapMoveSettled: reverseGeocodeState.notifyMapMoveSettled,
  }),
}));

vi.mock("@/lib/geocoding/maptiler-forward-geocode", () => ({
  mapTilerForwardGeocodeSearch: mapTilerForwardGeocodeSearchMock,
}));

vi.mock("@/components/spots/SpotLocationPickerLoader", () => ({
  SpotLocationPickerLoader: ({
    latitude,
    longitude,
    onLocationChange,
    onUserMovedMap,
    onCurrentLocationRequested,
    onCurrentLocationResolved,
  }: {
    latitude: number;
    longitude: number;
    onLocationChange?: (latitude: number, longitude: number) => void;
    onUserMovedMap?: () => void;
    onCurrentLocationRequested?: () => void;
    onCurrentLocationResolved?: (fix: {
      latitude: number;
      longitude: number;
      accuracy: number | null;
      timestamp: number;
    }) => void;
    userLatitude?: number | null;
    userLongitude?: number | null;
  }) => (
    <div
      role="img"
      aria-label="Map to adjust your parking spot location"
      data-testid="leaver-map-picker"
    >
      Map at {latitude}, {longitude}
      <button
        type="button"
        onClick={() => {
          onUserMovedMap?.();
          onLocationChange?.(32.111111, 34.222222);
        }}
      >
        Simulate map move
      </button>
      <button
        type="button"
        aria-label="Use my current location"
        onClick={() => {
          onCurrentLocationRequested?.();
          onCurrentLocationResolved?.({
            latitude: 32.085312,
            longitude: 34.781812,
            accuracy: 8,
            timestamp: Date.now(),
          });
          onLocationChange?.(32.085312, 34.781812);
        }}
      >
        Center
      </button>
    </div>
  ),
}));

function fieldErrorsFromZod(error: import("zod").ZodError) {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    fieldErrors[key] ??= [];
    fieldErrors[key].push(issue.message);
  }
  return fieldErrors;
}

function mockPublishWithSchemaValidation() {
  publishSpotMock.mockImplementation(
    async (_prev: unknown, formData: FormData) => {
      const parsed = publishSpotSchema.safeParse({
        latitude: formData.get("latitude"),
        longitude: formData.get("longitude"),
        address: formData.get("address") ?? "",
        available_in_minutes: formData.get("available_in_minutes"),
      });

      if (!parsed.success) {
        return { fieldErrors: fieldErrorsFromZod(parsed.error) };
      }

      return {};
    },
  );
}

function stubGeolocation(
  implementation: (
    success: PositionCallback,
    error?: PositionErrorCallback,
  ) => void,
) {
  vi.stubGlobal("navigator", {
    ...navigator,
    geolocation: {
      getCurrentPosition: vi.fn(implementation),
      watchPosition: vi.fn((success, error) => {
        implementation(success, error);
        return 1;
      }),
      clearWatch: vi.fn(),
    },
  });
}

function position(
  latitude: number,
  longitude: number,
  accuracy: number,
  timestamp = Date.now(),
): GeolocationPosition {
  return {
    coords: {
      latitude,
      longitude,
      accuracy,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    },
    timestamp,
  } as GeolocationPosition;
}

describe("PublishSpotForm", () => {
  beforeEach(() => {
    publishSpotMock.mockReset();
    mockPublishWithSchemaValidation();
    reverseGeocodeState.status = "idle";
    reverseGeocodeState.label = null;
    reverseGeocodeState.addressForPublish = null;
    reverseGeocodeState.isUpdating = false;
    reverseGeocodeState.notifyMapMoveStart.mockReset();
    reverseGeocodeState.notifyMapMoveSettled.mockReset();
    stubGeolocation((success) => {
      success(position(32.085312, 34.781812, 10));
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the compact compose layout with leave-time grid and primary action", async () => {
    render(<FeedbackShell><PublishSpotForm /></FeedbackShell>);

    const form = screen.getByTestId("publish-spot-form");
    expect(form.className).toContain("publisher-compose");
    expect(form.querySelector(".publisher-compose-surface")).not.toBeNull();
    expect(screen.getByTestId("leave-time-slider")).toBeInTheDocument();
    expect(screen.getByTestId("leave-time-range")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Share spot" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "More" })).not.toBeInTheDocument();
    expect(screen.queryByText("Your parking spot")).not.toBeInTheDocument();
    expect(screen.queryByText("Share my parking spot")).not.toBeInTheDocument();

    await waitFor(() => {
      // Address label is display-only; we no longer show the exact fallback.
      expect(screen.queryByText("Exact location marked on map")).not.toBeInTheDocument();
      expect(
        screen.queryByText("Finding the address…"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("Finding the address..."),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByText("Parking spot location")).toBeInTheDocument();
    expect(
      screen.queryByTestId("publisher-location-accuracy"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("publisher-location-accuracy-warning"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/±/)).not.toBeInTheDocument();
    expect(screen.queryByTestId("publisher-pin-hint")).not.toBeInTheDocument();
    expect(
      screen.queryByText("You can move the map to adjust the spot."),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("This coordinates a handoff; it does not reserve the spot."),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("leaver-map-picker")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Enter coordinates manually" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Latitude")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Longitude")).not.toBeInTheDocument();
  });

  it("updates hidden coordinates from the map picker callback", async () => {
    const user = userEvent.setup();
    render(<FeedbackShell><PublishSpotForm /></FeedbackShell>);

    await waitFor(() => {
      expect(screen.getByTestId("leaver-map-picker")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Simulate map move" }));
    await user.click(screen.getByRole("button", { name: "Share spot" }));

    await waitFor(() => {
      expect(publishSpotMock).toHaveBeenCalledTimes(1);
    });

    const formData = publishSpotMock.mock.calls[0]?.[1] as FormData;
    expect(formData.get("latitude")).toBe("32.111111");
    expect(formData.get("longitude")).toBe("34.222222");
  });

  it("submits coordinates from automatic geolocation", async () => {
    const user = userEvent.setup();
    render(<FeedbackShell><PublishSpotForm /></FeedbackShell>);

    await waitFor(() => {
      expect(screen.getByTestId("leaver-map-picker")).toBeInTheDocument();
    });
    expect(
      screen.queryByTestId("publisher-location-accuracy-warning"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/±/)).not.toBeInTheDocument();

    const range = screen.getByTestId("leave-time-range");
    fireEvent.change(range, { target: { value: "10" } });
    await user.click(screen.getByRole("button", { name: "Share spot" }));

    await waitFor(() => {
      expect(publishSpotMock).toHaveBeenCalledTimes(1);
    });

    const formData = publishSpotMock.mock.calls[0]?.[1] as FormData;
    expect(formData.get("latitude")).toBe("32.085312");
    expect(formData.get("longitude")).toBe("34.781812");
    expect(formData.get("available_in_minutes")).toBe("10");
  });

  it("requests geolocation automatically on load", async () => {
    const watchPosition = vi.fn((success: PositionCallback) => {
      success(position(32, 34, 10));
      return 1;
    });

    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: {
        getCurrentPosition: vi.fn(),
        watchPosition,
        clearWatch: vi.fn(),
      },
    });
    render(<FeedbackShell><PublishSpotForm /></FeedbackShell>);

    await waitFor(() => {
      expect(watchPosition).toHaveBeenCalledTimes(1);
    });
    expect(watchPosition.mock.calls[0]?.[2]).toEqual(
      expect.objectContaining({
        enableHighAccuracy: true,
        maximumAge: 0,
      }),
    );
  });

  it("renders the map at the fallback center immediately while GPS is pending", async () => {
    let success: PositionCallback | null = null;
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: {
        getCurrentPosition: vi.fn(),
        watchPosition: vi.fn((nextSuccess: PositionCallback) => {
          success = nextSuccess;
          return 1;
        }),
        clearWatch: vi.fn(),
      },
    });

    render(<FeedbackShell><PublishSpotForm /></FeedbackShell>);

    expect(screen.getByTestId("leaver-map-picker")).toHaveTextContent(
      `Map at ${MAP_DEFAULT_CENTER.lat}, ${MAP_DEFAULT_CENTER.lng}`,
    );
    expect(screen.getByTestId("publisher-location-status")).toHaveTextContent(
      "Finding your location…",
    );
    expect(screen.getByRole("button", { name: "Share spot" })).toBeDisabled();

    success?.(position(32.085312, 34.781812, 10));
    await waitFor(() => {
      expect(screen.getByTestId("leaver-map-picker")).toHaveTextContent(
        "Map at 32.085312, 34.781812",
      );
    });
    expect(screen.getByRole("button", { name: "Share spot" })).toBeEnabled();
  });

  it("does not publish fallback coordinates when GPS fails", async () => {
    stubGeolocation((_success, error) => {
      error?.({
        code: 3,
        message: "Timeout",
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      } as GeolocationPositionError);
    });

    render(<FeedbackShell><PublishSpotForm /></FeedbackShell>);

    expect(screen.getByTestId("leaver-map-picker")).toHaveTextContent(
      `Map at ${MAP_DEFAULT_CENTER.lat}, ${MAP_DEFAULT_CENTER.lng}`,
    );
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Share spot" })).toBeDisabled();
    });
    expect(publishSpotMock).not.toHaveBeenCalled();
  });

  it("lets a fresh GPS sample replace a stale cached location during init", async () => {
    let success: PositionCallback | null = null;
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: {
        getCurrentPosition: vi.fn(),
        watchPosition: vi.fn((nextSuccess: PositionCallback) => {
          success = nextSuccess;
          return 1;
        }),
        clearWatch: vi.fn(),
      },
    });

    render(<FeedbackShell><PublishSpotForm /></FeedbackShell>);
    expect(screen.getByTestId("leaver-map-picker")).toHaveTextContent(
      `Map at ${MAP_DEFAULT_CENTER.lat}, ${MAP_DEFAULT_CENTER.lng}`,
    );

    success?.(
      position(32.08, 34.78, 8, Date.now() - 60_000),
    );
    expect(screen.getByTestId("leaver-map-picker")).toHaveTextContent(
      `Map at ${MAP_DEFAULT_CENTER.lat}, ${MAP_DEFAULT_CENTER.lng}`,
    );

    success?.(position(32.26, 34.89, 18));
    await waitFor(() => {
      expect(screen.getByTestId("leaver-map-picker")).toHaveTextContent(
        "Map at 32.26, 34.89",
      );
    });
    expect(screen.getByRole("button", { name: "Share spot" })).toBeEnabled();
  });

  it("starts a new GPS watch when the screen is opened again", async () => {
    const watchPosition = vi.fn((nextSuccess: PositionCallback) => {
      nextSuccess(position(32.085312, 34.781812, 10));
      return 1;
    });
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: {
        getCurrentPosition: vi.fn(),
        watchPosition,
        clearWatch: vi.fn(),
      },
    });

    const { unmount } = render(
      <FeedbackShell><PublishSpotForm /></FeedbackShell>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("leaver-map-picker")).toHaveTextContent(
        "Map at 32.085312, 34.781812",
      );
    });
    expect(watchPosition).toHaveBeenCalledTimes(1);

    unmount();
    render(<FeedbackShell><PublishSpotForm /></FeedbackShell>);
    await waitFor(() => {
      expect(watchPosition).toHaveBeenCalledTimes(2);
    });
  });

  it("does not let a late GPS fix overwrite an early manual pin move", async () => {
    const user = userEvent.setup();
    let success: PositionCallback | null = null;
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: {
        getCurrentPosition: vi.fn(),
        watchPosition: vi.fn((nextSuccess: PositionCallback) => {
          success = nextSuccess;
          return 1;
        }),
        clearWatch: vi.fn(),
      },
    });

    render(<FeedbackShell><PublishSpotForm /></FeedbackShell>);

    expect(screen.getByTestId("leaver-map-picker")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Simulate map move" }));
    expect(screen.getByTestId("leaver-map-picker")).toHaveTextContent(
      "Map at 32.111111, 34.222222",
    );

    success?.(position(32.085312, 34.781812, 8));
    expect(screen.getByTestId("leaver-map-picker")).toHaveTextContent(
      "Map at 32.111111, 34.222222",
    );
  });

  it("offers map fallback when geolocation is denied", async () => {
    const user = userEvent.setup();
    stubGeolocation((_success, error) => {
      error?.({
        code: 1,
        message: "User denied geolocation",
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      } as GeolocationPositionError);
    });

    render(<FeedbackShell><PublishSpotForm /></FeedbackShell>);

    expect(screen.getByTestId("leaver-map-picker")).toHaveTextContent(
      `Map at ${MAP_DEFAULT_CENTER.lat}, ${MAP_DEFAULT_CENTER.lng}`,
    );
    expect(
      await screen.findByText(
        "Location permission denied. Place the pin on the map yourself.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId("location-unavailable")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Choose on map" }));

    await waitFor(() => {
      expect(screen.getByTestId("leaver-map-picker")).toBeInTheDocument();
      expect(
        screen.getByRole("img", {
          name: "Map to adjust your parking spot location",
        }),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: "Use my current location" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Latitude")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Share spot" }));

    await waitFor(() => {
      expect(publishSpotMock).toHaveBeenCalledTimes(1);
    });
  });

  it("shows current-location control after geolocation success and in choose-on-map mode", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<FeedbackShell><PublishSpotForm /></FeedbackShell>);

    await waitFor(() => {
      expect(screen.getByTestId("leaver-map-picker")).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: "Use my current location" }),
    ).toBeInTheDocument();
    unmount();

    stubGeolocation((_success, error) => {
      error?.({
        code: 1,
        message: "User denied geolocation",
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      } as GeolocationPositionError);
    });

    render(<FeedbackShell><PublishSpotForm /></FeedbackShell>);
    await user.click(
      await screen.findByRole("button", { name: "Choose on map" }),
    );
    expect(
      screen.getByRole("button", { name: "Use my current location" }),
    ).toBeInTheDocument();
  });

  it("submits optional address when reverse geocoding resolves", async () => {
    const user = userEvent.setup();
    reverseGeocodeState.status = "success";
    reverseGeocodeState.label = "Dizengoff Street 120, Tel Aviv";
    reverseGeocodeState.addressForPublish = "Dizengoff Street 120, Tel Aviv";

    render(<FeedbackShell><PublishSpotForm /></FeedbackShell>);

    await waitFor(() => {
      expect(screen.getByTestId("publisher-address-label")).toHaveTextContent(
        "Dizengoff Street 120, Tel Aviv",
      );
    });

    await user.click(screen.getByRole("button", { name: "Share spot" }));

    await waitFor(() => {
      expect(publishSpotMock).toHaveBeenCalledTimes(1);
    });

    const formData = publishSpotMock.mock.calls[0]?.[1] as FormData;
    expect(formData.get("address")).toBe("Dizengoff Street 120, Tel Aviv");
  });

  it("publishes with null address while lookup is still pending", async () => {
    const user = userEvent.setup();
    reverseGeocodeState.status = "loading";
    reverseGeocodeState.label = null;
    reverseGeocodeState.addressForPublish = null;

    render(<FeedbackShell><PublishSpotForm /></FeedbackShell>);

    await waitFor(() => {
      expect(screen.getByTestId("leaver-map-picker")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Share spot" }));

    await waitFor(() => {
      expect(publishSpotMock).toHaveBeenCalledTimes(1);
    });

    const formData = publishSpotMock.mock.calls[0]?.[1] as FormData;
    expect(formData.get("address")).toBe("");
  });

  it("keeps the map picker mounted when leave time changes", async () => {
    render(<FeedbackShell><PublishSpotForm /></FeedbackShell>);

    await waitFor(() => {
      expect(screen.getByTestId("leaver-map-picker")).toBeInTheDocument();
    });

    const range = screen.getByTestId("leave-time-range");
    fireEvent.change(range, { target: { value: "5" } });
    expect(screen.getByTestId("leaver-map-picker")).toBeInTheDocument();
    fireEvent.change(range, { target: { value: "10" } });
    expect(screen.getByTestId("leaver-map-picker")).toBeInTheDocument();
  });

  it("shows a pending disabled submit state while publishing", async () => {
    const user = userEvent.setup();
    let resolvePublish: (value: Record<string, never>) => void = () => {};
    publishSpotMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePublish = resolve;
        }),
    );

    render(<FeedbackShell><PublishSpotForm /></FeedbackShell>);

    await waitFor(() => {
      expect(screen.getByTestId("leaver-map-picker")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Share spot" }));

    const pendingButton = await screen.findByRole("button", {
      name: "Sharing…",
    });
    expect(pendingButton).toBeDisabled();

    resolvePublish({});
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Share spot" }),
      ).toBeEnabled();
    });
  });

  it("prefers the more accurate GPS fix when several arrive", async () => {
    let success: PositionCallback | null = null;
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: {
        getCurrentPosition: vi.fn(),
        watchPosition: vi.fn((nextSuccess: PositionCallback) => {
          success = nextSuccess;
          return 4;
        }),
        clearWatch: vi.fn(),
      },
    });

    render(<FeedbackShell><PublishSpotForm /></FeedbackShell>);

    success?.(position(32.08, 34.78, 42));
    await waitFor(() => {
      expect(screen.getByTestId("leaver-map-picker")).toHaveTextContent(
        "Map at 32.08, 34.78",
      );
    });

    success?.(position(32.085312, 34.781812, 9));
    await waitFor(() => {
      expect(screen.getByTestId("leaver-map-picker")).toHaveTextContent(
        "Map at 32.085312, 34.781812",
      );
    });
    expect(
      screen.queryByTestId("publisher-location-accuracy-warning"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/±/)).not.toBeInTheDocument();
  });

  it("hides accuracy copy when GPS accuracy is good", async () => {
    stubGeolocation((success) => {
      success(position(32.085312, 34.781812, 10));
    });

    render(<FeedbackShell><PublishSpotForm /></FeedbackShell>);

    await waitFor(() => {
      expect(screen.getByTestId("leaver-map-picker")).toBeInTheDocument();
    });
    expect(
      screen.queryByTestId("publisher-location-accuracy-warning"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/±/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Location accuracy:/i)).not.toBeInTheDocument();
  });

  it("hides accuracy copy when GPS accuracy is acceptable", async () => {
    stubGeolocation((success) => {
      success(position(32.085312, 34.781812, 28));
    });

    render(<FeedbackShell><PublishSpotForm /></FeedbackShell>);

    await waitFor(() => {
      expect(screen.getByTestId("leaver-map-picker")).toBeInTheDocument();
    });
    expect(
      screen.queryByTestId("publisher-location-accuracy-warning"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/±/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Location accuracy:/i)).not.toBeInTheDocument();
  });

  it("warns when GPS accuracy is poor without blocking publish", async () => {
    const user = userEvent.setup();
    stubGeolocation((success) => {
      success(position(32.085312, 34.781812, 45));
    });

    render(<FeedbackShell><PublishSpotForm /></FeedbackShell>);

    const warning = await screen.findByTestId(
      "publisher-location-accuracy-warning",
    );
    expect(warning).toHaveTextContent(PUBLISHER_POOR_LOCATION_WARNING);
    expect(warning.textContent).not.toMatch(/±/);
    expect(warning.textContent).not.toMatch(/\d+\s*m/);
    expect(
      screen.queryByTestId("publisher-location-accuracy"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Location accuracy:/i)).not.toBeInTheDocument();

    const shareButton = screen.getByRole("button", { name: "Share spot" });
    expect(shareButton).toBeEnabled();
    await user.click(shareButton);
    await waitFor(() => {
      expect(publishSpotMock).toHaveBeenCalledTimes(1);
    });
  });

  it("removes the poor-accuracy warning when a better GPS fix arrives", async () => {
    let success: PositionCallback | null = null;
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: {
        getCurrentPosition: vi.fn(),
        watchPosition: vi.fn((nextSuccess: PositionCallback) => {
          success = nextSuccess;
          nextSuccess(position(32.085312, 34.781812, 45));
          return 6;
        }),
        clearWatch: vi.fn(),
      },
    });

    render(<FeedbackShell><PublishSpotForm /></FeedbackShell>);

    expect(
      await screen.findByTestId("publisher-location-accuracy-warning"),
    ).toHaveTextContent(PUBLISHER_POOR_LOCATION_WARNING);

    success?.(position(32.085312, 34.781812, 9));

    await waitFor(() => {
      expect(
        screen.queryByTestId("publisher-location-accuracy-warning"),
      ).not.toBeInTheDocument();
    });
    expect(screen.queryByText(/±/)).not.toBeInTheDocument();
  });

  it("keeps a manually moved pin when later GPS updates arrive", async () => {
    const user = userEvent.setup();
    let success: PositionCallback | null = null;
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: {
        getCurrentPosition: vi.fn(),
        watchPosition: vi.fn((nextSuccess: PositionCallback) => {
          success = nextSuccess;
          nextSuccess(position(32.085312, 34.781812, 40));
          return 5;
        }),
        clearWatch: vi.fn(),
      },
    });

    render(<FeedbackShell><PublishSpotForm /></FeedbackShell>);
    await waitFor(() => {
      expect(screen.getByTestId("leaver-map-picker")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Simulate map move" }));
    expect(screen.getByTestId("leaver-map-picker")).toHaveTextContent(
      "Map at 32.111111, 34.222222",
    );
    expect(
      screen.queryByTestId("publisher-location-accuracy"),
    ).not.toBeInTheDocument();

    success?.(position(32.099999, 34.799999, 8));
    expect(screen.getByTestId("leaver-map-picker")).toHaveTextContent(
      "Map at 32.111111, 34.222222",
    );

    await user.click(screen.getByRole("button", { name: "Share spot" }));
    await waitFor(() => {
      expect(publishSpotMock).toHaveBeenCalledTimes(1);
    });
    const formData = publishSpotMock.mock.calls[0]?.[1] as FormData;
    expect(formData.get("latitude")).toBe("32.111111");
    expect(formData.get("longitude")).toBe("34.222222");
  });

  it("returns to a fresh GPS fix when Use my current location is pressed", async () => {
    const user = userEvent.setup();
    render(<FeedbackShell><PublishSpotForm /></FeedbackShell>);

    await waitFor(() => {
      expect(screen.getByTestId("leaver-map-picker")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Simulate map move" }));
    expect(screen.getByTestId("leaver-map-picker")).toHaveTextContent(
      "Map at 32.111111, 34.222222",
    );

    await user.click(
      screen.getByRole("button", { name: "Use my current location" }),
    );

    expect(screen.getByTestId("leaver-map-picker")).toHaveTextContent(
      "Map at 32.085312, 34.781812",
    );
    expect(
      screen.queryByTestId("publisher-location-accuracy-warning"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/±/)).not.toBeInTheDocument();
  });

  it("search an address, select a result, and updates marker + publish coordinates", async () => {
    mapTilerForwardGeocodeSearchMock.mockResolvedValueOnce([
      {
        latitude: 32.1,
        longitude: 34.2,
        label: "Dizengoff 120, Tel Aviv",
      },
    ]);

    const user = userEvent.setup();
    render(<FeedbackShell><PublishSpotForm /></FeedbackShell>);

    const searchInput = await screen.findByPlaceholderText(
      "Search an address",
    );
    await user.type(searchInput, "Dizengoff 100, Tel Aviv");

    await new Promise((resolve) => window.setTimeout(resolve, 400));

    const suggestion = await screen.findByText(
      "Dizengoff 120, Tel Aviv",
    );
    await user.click(suggestion);

    expect(screen.getByTestId("leaver-map-picker")).toHaveTextContent(
      "Map at 32.1, 34.2",
    );

    await user.click(screen.getByRole("button", { name: "Share spot" }));

    await waitFor(() => {
      expect(publishSpotMock).toHaveBeenCalledTimes(1);
    });

    const formData = publishSpotMock.mock.calls[0]?.[1] as FormData;
    expect(formData.get("latitude")).toBe("32.100000");
    expect(formData.get("longitude")).toBe("34.200000");
  });

  it("manual pin movement after address selection overrides the chosen coordinates and clears the address", async () => {
    mapTilerForwardGeocodeSearchMock.mockResolvedValueOnce([
      {
        latitude: 32.2,
        longitude: 34.3,
        label: "Dizengoff 200, Tel Aviv",
      },
    ]);

    const user = userEvent.setup();
    render(<FeedbackShell><PublishSpotForm /></FeedbackShell>);

    const searchInput = await screen.findByPlaceholderText(
      "Search an address",
    );
    await user.type(searchInput, "Dizengoff 200");
    await new Promise((resolve) => window.setTimeout(resolve, 400));

    const suggestion = await screen.findByText("Dizengoff 200, Tel Aviv");
    await user.click(suggestion);

    expect(screen.getByTestId("leaver-map-picker")).toHaveTextContent(
      "Map at 32.2, 34.3",
    );

    await user.click(screen.getByRole("button", { name: "Simulate map move" }));
    expect(screen.getByTestId("leaver-map-picker")).toHaveTextContent(
      "Map at 32.111111, 34.222222",
    );

    await user.click(screen.getByRole("button", { name: "Share spot" }));
    await waitFor(() => {
      expect(publishSpotMock).toHaveBeenCalledTimes(1);
    });

    const formData = publishSpotMock.mock.calls[0]?.[1] as FormData;
    expect(formData.get("latitude")).toBe("32.111111");
    expect(formData.get("longitude")).toBe("34.222222");
    expect(formData.get("address")).toBe("");
  });

  it("stale address search results cannot overwrite a newer manual selection", async () => {
    let resolveFirst:
      | ((value: Array<{ latitude: number; longitude: number; label: string }>) => void)
      | null = null;
    let resolveSecond:
      | ((value: Array<{ latitude: number; longitude: number; label: string }>) => void)
      | null = null;

    mapTilerForwardGeocodeSearchMock.mockImplementation((q: string) => {
      if (q.includes("First")) {
        return new Promise((res) => {
          resolveFirst = res;
        });
      }
      return new Promise((res) => {
        resolveSecond = res;
      });
    });

    const user = userEvent.setup();
    render(<FeedbackShell><PublishSpotForm /></FeedbackShell>);

    const searchInput = await screen.findByPlaceholderText(
      "Search an address",
    );

    await user.type(searchInput, "First address");
    await new Promise((resolve) => window.setTimeout(resolve, 400));

    await user.clear(searchInput);
    await user.type(searchInput, "Second address");
    await new Promise((resolve) => window.setTimeout(resolve, 400));

    resolveSecond?.([
      { latitude: 32.4, longitude: 34.5, label: "Result 2" },
    ]);
    const result2 = await screen.findByText("Result 2");
    expect(result2).toBeInTheDocument();

    await user.click(screen.getByText("Result 2"));
    expect(screen.getByTestId("leaver-map-picker")).toHaveTextContent(
      "Map at 32.4, 34.5",
    );

    resolveFirst?.([
      { latitude: 31.0, longitude: 35.0, label: "Result 1" },
    ]);
    await Promise.resolve();

    // The stale result should not appear as a suggestion.
    expect(screen.queryByText("Result 1")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Share spot" }));
    await waitFor(() => {
      expect(publishSpotMock).toHaveBeenCalledTimes(1);
    });
    const formData = publishSpotMock.mock.calls[0]?.[1] as FormData;
    expect(formData.get("latitude")).toBe("32.400000");
    expect(formData.get("longitude")).toBe("34.500000");
  });

  it("hebrew search prioritizes Israeli results, renders RTL suggestions, and moves the marker", async () => {
    mapTilerForwardGeocodeSearchMock.mockClear();
    mapTilerForwardGeocodeSearchMock.mockResolvedValueOnce([
      {
        latitude: 32.085,
        longitude: 34.79,
        label: "דיזנגוף, תל אביב-יפו",
      },
    ]);

    const user = userEvent.setup();
    render(<FeedbackShell><PublishSpotForm /></FeedbackShell>);

    const searchInput = await screen.findByPlaceholderText(
      "Search an address",
    );

    await user.type(searchInput, "דיזינגוף תל אביב");

    expect(searchInput).toHaveAttribute("dir", "rtl");

    await new Promise((resolve) => window.setTimeout(resolve, 400));

    // Provider label should be Hebrew and shown in the dropdown.
    await screen.findByText("דיזנגוף, תל אביב-יפו");
    expect(screen.getByRole("listbox")).toHaveAttribute("dir", "rtl");

    expect(mapTilerForwardGeocodeSearchMock).toHaveBeenCalled();
    const lastCall = mapTilerForwardGeocodeSearchMock.mock.calls.at(-1);
    const [query, options] = lastCall ?? [];
    expect(query).toBe("דיזינגוף תל אביב");
    expect(options).toEqual(
      expect.objectContaining({
        language: "he",
        country: "il",
        types: expect.arrayContaining(["address", "road"]),
      }),
    );

    await user.click(screen.getByText("דיזנגוף, תל אביב-יפו"));

    expect(screen.getByTestId("leaver-map-picker")).toHaveTextContent(
      "Map at 32.085, 34.79",
    );

    await user.click(screen.getByRole("button", { name: "Share spot" }));
    await waitFor(() => {
      expect(publishSpotMock).toHaveBeenCalledTimes(1);
    });
  });

  it("hebrew selection works with street-only results (house number not required)", async () => {
    mapTilerForwardGeocodeSearchMock.mockResolvedValueOnce([
      {
        latitude: 32.086,
        longitude: 34.788,
        label: "דיזנגוף, תל אביב-יפו",
      },
    ]);

    const user = userEvent.setup();
    render(<FeedbackShell><PublishSpotForm /></FeedbackShell>);

    const searchInput = await screen.findByPlaceholderText(
      "Search an address",
    );

    await user.type(searchInput, "דיזנגוף 100 תל אביב");
    await new Promise((resolve) => window.setTimeout(resolve, 400));

    await screen.findByText("דיזנגוף, תל אביב-יפו");
    await user.click(screen.getByText("דיזנגוף, תל אביב-יפו"));

    // Marker should update even without a house-number-specific match.
    expect(screen.getByTestId("leaver-map-picker")).toHaveTextContent(
      "Map at 32.086, 34.788",
    );

    await user.click(screen.getByRole("button", { name: "Share spot" }));
    await waitFor(() => {
      expect(publishSpotMock).toHaveBeenCalledTimes(1);
    });
  });

  it("stale hebrew autocomplete responses cannot overwrite a newer query", async () => {
    let resolveFirst:
      | ((value: Array<{ latitude: number; longitude: number; label: string }>) => void)
      | null = null;
    let resolveSecond:
      | ((value: Array<{ latitude: number; longitude: number; label: string }>) => void)
      | null = null;

    mapTilerForwardGeocodeSearchMock.mockImplementation((q: string) => {
      if (q.includes("דיזינגוף")) {
        return new Promise((res) => {
          resolveFirst = res;
        });
      }
      return new Promise((res) => {
        resolveSecond = res;
      });
    });

    const user = userEvent.setup();
    render(<FeedbackShell><PublishSpotForm /></FeedbackShell>);

    const searchInput = await screen.findByPlaceholderText(
      "Search an address",
    );

    await user.type(searchInput, "דיזינגוף תל אביב");
    await new Promise((resolve) => window.setTimeout(resolve, 400));

    await user.clear(searchInput);
    await user.type(searchInput, "אבן גבירול תל אביב");
    await new Promise((resolve) => window.setTimeout(resolve, 400));

    resolveSecond?.([
      { latitude: 32.1, longitude: 34.78, label: "אבן גבירול, תל אביב-יפו" },
    ]);
    await Promise.resolve();

    expect(
      await screen.findByText("אבן גבירול, תל אביב-יפו"),
    ).toBeInTheDocument();

    resolveFirst?.([
      { latitude: 32.0, longitude: 34.9, label: "דיזינגוף, תל אביב-יפו" },
    ]);
    await Promise.resolve();

    expect(screen.queryByText("דיזינגוף, תל אביב-יפו")).not.toBeInTheDocument();
  });

  it("publishes coordinates when reverse geocoding is unavailable", async () => {
    const user = userEvent.setup();
    reverseGeocodeState.status = "unavailable";
    reverseGeocodeState.label = null;
    reverseGeocodeState.addressForPublish = null;

    render(<FeedbackShell><PublishSpotForm /></FeedbackShell>);

    // Address is display-only and never blocks publishing.
    expect(
      screen.queryByText("Exact location marked on map"),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Share spot" }));
    await waitFor(() => {
      expect(publishSpotMock).toHaveBeenCalledTimes(1);
    });

    const formData = publishSpotMock.mock.calls[0]?.[1] as FormData;
    expect(formData.get("latitude")).toBe("32.085312");
    expect(formData.get("longitude")).toBe("34.781812");
    expect(formData.get("address")).toBe("");
  });
});
