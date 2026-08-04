import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PublishSpotForm } from "@/components/spots/PublishSpotForm";
import { publishSpotSchema } from "@/lib/validations/spot";

const { publishSpotMock } = vi.hoisted(() => ({
  publishSpotMock: vi.fn(),
}));

vi.mock("@/actions/spots", () => ({
  publishSpot: publishSpotMock,
}));

vi.mock("@/components/spots/SpotLocationPickerLoader", () => ({
  SpotLocationPickerLoader: ({
    latitude,
    longitude,
  }: {
    latitude: number;
    longitude: number;
  }) => (
    <div role="img" aria-label="Map to adjust your parking spot location">
      Map at {latitude}, {longitude}
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
    geolocation: { getCurrentPosition: vi.fn(implementation) },
  });
}

describe("PublishSpotForm", () => {
  beforeEach(() => {
    publishSpotMock.mockReset();
    mockPublishWithSchemaValidation();
    stubGeolocation((success) => {
      success({
        coords: {
          latitude: 32.085312,
          longitude: 34.781812,
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      } as GeolocationPosition);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the location section, leave-time choices, and primary action", async () => {
    render(<PublishSpotForm />);

    expect(screen.getByText("Your parking spot")).toBeInTheDocument();
    expect(
      screen.getByText("Check that the marker is in the right place."),
    ).toBeInTheDocument();
    expect(screen.getByRole("radiogroup")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Share this spot" }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Location found")).toBeInTheDocument();
    });
  });

  it("submits coordinates from automatic geolocation", async () => {
    const user = userEvent.setup();
    render(<PublishSpotForm />);

    await waitFor(() => {
      expect(screen.getByText("Location found")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("radio", { name: "10 min" }));
    await user.click(screen.getByRole("button", { name: "Share this spot" }));

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
    render(<PublishSpotForm />);

    await waitFor(() => {
      expect(screen.getByText("Location found")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Enter coordinates manually" }));
    await user.clear(screen.getByLabelText("Latitude"));
    await user.type(screen.getByLabelText("Latitude"), "91");
    await user.clear(screen.getByLabelText("Longitude"));
    await user.type(screen.getByLabelText("Longitude"), "181");

    const form = screen
      .getByRole("button", { name: "Share this spot" })
      .closest("form");
    form!.noValidate = true;

    await user.click(screen.getByRole("button", { name: "Share this spot" }));

    expect(
      await screen.findByText("Latitude must be between -90 and 90."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Longitude must be between -180 and 180."),
    ).toBeInTheDocument();
  });

  it("requests geolocation automatically on load", async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: {
          latitude: 32,
          longitude: 34,
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      } as GeolocationPosition);
    });

    stubGeolocation(getCurrentPosition);
    render(<PublishSpotForm />);

    await waitFor(() => {
      expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    });
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

    render(<PublishSpotForm />);

    expect(
      await screen.findByText("We couldn’t access your location."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Choose on map" }));

    await waitFor(() => {
      expect(
        screen.getByRole("img", {
          name: "Map to adjust your parking spot location",
        }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Share this spot" }));

    await waitFor(() => {
      expect(publishSpotMock).toHaveBeenCalledTimes(1);
    });
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

    render(<PublishSpotForm />);

    await waitFor(() => {
      expect(screen.getByText("Location found")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Share this spot" }));

    const pendingButton = await screen.findByRole("button", {
      name: "Sharing…",
    });
    expect(pendingButton).toBeDisabled();

    resolvePublish({});
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Share this spot" }),
      ).toBeEnabled();
    });
  });
});
