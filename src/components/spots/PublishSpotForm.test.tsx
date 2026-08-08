import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FeedbackShell } from "@/components/feedback/FeedbackShell";
import { PublishSpotForm } from "@/components/spots/PublishSpotForm";
import { publishSpotSchema } from "@/lib/validations/spot";

const { publishSpotMock } = vi.hoisted(() => ({
  publishSpotMock: vi.fn(),
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

vi.mock("@/components/spots/SpotLocationPickerLoader", () => ({
  SpotLocationPickerLoader: ({
    latitude,
    longitude,
    onLocationChange,
    onUserMovedMap,
    onCurrentLocationResolved,
  }: {
    latitude: number;
    longitude: number;
    onLocationChange?: (latitude: number, longitude: number) => void;
    onUserMovedMap?: () => void;
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
    timestamp: Date.now(),
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
      expect(screen.getByTestId("publisher-location-status")).toHaveTextContent(
        "Exact location marked on map",
      );
    });
    expect(screen.getByText("Parking spot location")).toBeInTheDocument();
    expect(screen.getByTestId("publisher-location-accuracy")).toHaveTextContent(
      "Location accuracy: ±10 m",
    );
    expect(screen.getByTestId("publisher-pin-hint")).toHaveTextContent(
      "Drag the pin if needed to mark the exact parking spot.",
    );
    expect(
      screen.queryByText("You can move the map to adjust the spot."),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("This coordinates a handoff; it does not reserve the spot."),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("leaver-map-picker")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Enter coordinates manually" }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("Latitude")).not.toBeInTheDocument();
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
      expect(screen.getByTestId("publisher-location-accuracy")).toHaveTextContent(
        "Location accuracy: ±10 m",
      );
    });

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

  it("shows validation feedback for invalid coordinates via manual entry", async () => {
    const user = userEvent.setup();
    render(<FeedbackShell><PublishSpotForm /></FeedbackShell>);

    await waitFor(() => {
      expect(screen.getByTestId("leaver-map-picker")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Enter coordinates manually" }));
    await user.clear(screen.getByLabelText("Latitude"));
    await user.type(screen.getByLabelText("Latitude"), "91");
    await user.clear(screen.getByLabelText("Longitude"));
    await user.type(screen.getByLabelText("Longitude"), "181");

    const form = screen
      .getByRole("button", { name: "Share spot" })
      .closest("form");
    form!.noValidate = true;

    await user.click(screen.getByRole("button", { name: "Share spot" }));

    expect(
      await screen.findByText("Latitude must be between -90 and 90."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Longitude must be between -180 and 180."),
    ).toBeInTheDocument();
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
    expect(screen.getByTestId("publisher-location-accuracy")).toHaveTextContent(
      "Location accuracy: ±9 m",
    );
  });

  it("warns when GPS accuracy is poor without blocking publish", async () => {
    stubGeolocation((success) => {
      success(position(32.085312, 34.781812, 45));
    });

    render(<FeedbackShell><PublishSpotForm /></FeedbackShell>);

    expect(
      await screen.findByTestId("publisher-location-accuracy-warning"),
    ).toHaveTextContent("Location accuracy is low");
    expect(screen.getByTestId("publisher-location-accuracy")).toHaveTextContent(
      "Location accuracy: ±45 m",
    );
    expect(screen.getByRole("button", { name: "Share spot" })).toBeEnabled();
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
    expect(screen.getByTestId("publisher-location-accuracy")).toHaveTextContent(
      "Location accuracy: ±8 m",
    );
  });

  it("publishes coordinates when reverse geocoding is unavailable", async () => {
    const user = userEvent.setup();
    reverseGeocodeState.status = "unavailable";
    reverseGeocodeState.label = null;
    reverseGeocodeState.addressForPublish = null;

    render(<FeedbackShell><PublishSpotForm /></FeedbackShell>);

    expect(
      await screen.findByText("Exact location marked on map"),
    ).toBeInTheDocument();

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
