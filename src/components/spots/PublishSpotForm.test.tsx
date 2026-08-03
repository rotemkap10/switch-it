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

describe("PublishSpotForm", () => {
  beforeEach(() => {
    publishSpotMock.mockReset();
    mockPublishWithSchemaValidation();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the main fields and primary submit action", () => {
    render(<PublishSpotForm />);

    expect(screen.getByLabelText("Latitude")).toBeInTheDocument();
    expect(screen.getByLabelText("Longitude")).toBeInTheDocument();
    expect(screen.getByLabelText("Address (optional)")).toBeInTheDocument();
    expect(screen.getByLabelText("Expected leave time")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Share my parking spot" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Use my location" }),
    ).toBeInTheDocument();
  });

  it("submits valid manual coordinates through the publish action", async () => {
    const user = userEvent.setup();
    render(<PublishSpotForm />);

    await user.type(screen.getByLabelText("Latitude"), "32.0853");
    await user.type(screen.getByLabelText("Longitude"), "34.7818");
    await user.selectOptions(
      screen.getByLabelText("Expected leave time"),
      "10",
    );
    await user.click(
      screen.getByRole("button", { name: "Share my parking spot" }),
    );

    await waitFor(() => {
      expect(publishSpotMock).toHaveBeenCalledTimes(1);
    });

    const formData = publishSpotMock.mock.calls[0]?.[1] as FormData;
    expect(formData.get("latitude")).toBe("32.0853");
    expect(formData.get("longitude")).toBe("34.7818");
    expect(formData.get("available_in_minutes")).toBe("10");
  });

  it("shows validation feedback for invalid latitude and longitude", async () => {
    const user = userEvent.setup();
    render(<PublishSpotForm />);

    const form = screen
      .getByRole("button", { name: "Share my parking spot" })
      .closest("form");
    expect(form).toBeTruthy();
    // Bypass browser min/max so Zod field errors from the action can surface.
    form!.noValidate = true;

    await user.type(screen.getByLabelText("Latitude"), "91");
    await user.type(screen.getByLabelText("Longitude"), "181");
    await user.click(
      screen.getByRole("button", { name: "Share my parking spot" }),
    );

    expect(
      await screen.findByText("Latitude must be between -90 and 90."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Longitude must be between -180 and 180."),
    ).toBeInTheDocument();
  });

  it("rejects unsupported timing values on submit", async () => {
    const user = userEvent.setup();
    render(<PublishSpotForm />);

    await user.type(screen.getByLabelText("Latitude"), "32");
    await user.type(screen.getByLabelText("Longitude"), "34");

    const timing = screen.getByLabelText(
      "Expected leave time",
    ) as HTMLSelectElement;
    const unsupported = document.createElement("option");
    unsupported.value = "7";
    unsupported.textContent = "Unsupported";
    timing.appendChild(unsupported);
    await user.selectOptions(timing, "7");

    await user.click(
      screen.getByRole("button", { name: "Share my parking spot" }),
    );

    expect(
      await screen.findByText("Choose when you expect to leave."),
    ).toBeInTheDocument();
  });

  it("fills coordinates when geolocation succeeds", async () => {
    const user = userEvent.setup();
    const getCurrentPosition = vi.fn(
      (success: PositionCallback) => {
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
      },
    );

    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: { getCurrentPosition },
    });

    render(<PublishSpotForm />);
    await user.click(screen.getByRole("button", { name: "Use my location" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Latitude")).toHaveValue(32.085312);
      expect(screen.getByLabelText("Longitude")).toHaveValue(34.781812);
    });
  });

  it("keeps manual entry usable when geolocation is denied", async () => {
    const user = userEvent.setup();
    const getCurrentPosition = vi.fn(
      (_success: PositionCallback, error?: PositionErrorCallback) => {
        error?.({
          code: 1,
          message: "User denied geolocation",
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        } as GeolocationPositionError);
      },
    );

    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: { getCurrentPosition },
    });

    render(<PublishSpotForm />);
    await user.click(screen.getByRole("button", { name: "Use my location" }));

    expect(
      await screen.findByText(
        "Location unavailable. Enter coordinates manually.",
      ),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText("Latitude"), "32.1");
    await user.type(screen.getByLabelText("Longitude"), "34.8");
    await user.click(
      screen.getByRole("button", { name: "Share my parking spot" }),
    );

    await waitFor(() => {
      expect(publishSpotMock).toHaveBeenCalledTimes(1);
    });

    const formData = publishSpotMock.mock.calls[0]?.[1] as FormData;
    expect(formData.get("latitude")).toBe("32.1");
    expect(formData.get("longitude")).toBe("34.8");
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
    await user.type(screen.getByLabelText("Latitude"), "32");
    await user.type(screen.getByLabelText("Longitude"), "34");
    await user.click(
      screen.getByRole("button", { name: "Share my parking spot" }),
    );

    const pendingButton = await screen.findByRole("button", {
      name: "Sharing…",
    });
    expect(pendingButton).toBeDisabled();

    resolvePublish({});
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Share my parking spot" }),
      ).toBeEnabled();
    });
  });
});
