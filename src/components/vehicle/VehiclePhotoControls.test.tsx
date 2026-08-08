import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { uploadVehiclePhotoMock, removeVehiclePhotoMock } = vi.hoisted(() => ({
  uploadVehiclePhotoMock: vi.fn(),
  removeVehiclePhotoMock: vi.fn(),
}));

vi.mock("@/actions/vehicle-photo", () => ({
  uploadVehiclePhoto: uploadVehiclePhotoMock,
  removeVehiclePhoto: removeVehiclePhotoMock,
}));

import { VehiclePhotoControls } from "@/components/vehicle/VehiclePhotoControls";

describe("VehiclePhotoControls", () => {
  beforeEach(() => {
    uploadVehiclePhotoMock.mockReset();
    removeVehiclePhotoMock.mockReset();
  });

  it("lets a user add a photo without requiring it", async () => {
    const user = userEvent.setup();
    const onPhotoChange = vi.fn();
    uploadVehiclePhotoMock.mockResolvedValue({
      success: true,
      photoPath: "user/photo.jpg",
      photoUrl: "https://example.test/photo.jpg",
    });

    render(<VehiclePhotoControls onPhotoChange={onPhotoChange} />);

    expect(screen.getByText("Add a photo of your car")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Optional — helps other drivers recognize you during the handoff.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add vehicle photo" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Remove photo" }),
    ).not.toBeInTheDocument();

    const file = new File([new Uint8Array([1, 2, 3])], "car.jpg", {
      type: "image/jpeg",
    });
    await user.upload(screen.getByLabelText("Vehicle photo"), file);

    await waitFor(() => {
      expect(uploadVehiclePhotoMock).toHaveBeenCalled();
    });
    expect(onPhotoChange).toHaveBeenCalledWith({
      photoPath: "user/photo.jpg",
      photoUrl: "https://example.test/photo.jpg",
    });
  });

  it("shows change and remove when a photo already exists", async () => {
    const user = userEvent.setup();
    const onPhotoChange = vi.fn();
    removeVehiclePhotoMock.mockResolvedValue({
      success: true,
      photoPath: null,
      photoUrl: null,
    });

    render(
      <VehiclePhotoControls
        photoPath="user/photo.jpg"
        photoUrl="https://example.test/photo.jpg"
        onPhotoChange={onPhotoChange}
      />,
    );

    expect(screen.getByRole("button", { name: "Change photo" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove photo" }));

    await waitFor(() => {
      expect(removeVehiclePhotoMock).toHaveBeenCalled();
    });
    expect(onPhotoChange).toHaveBeenCalledWith({
      photoPath: null,
      photoUrl: null,
    });
  });

  it("shows a validation message when upload fails", async () => {
    const user = userEvent.setup();
    uploadVehiclePhotoMock.mockResolvedValue({
      error: "Use a JPEG, PNG, or WebP photo.",
    });

    render(<VehiclePhotoControls />);

    const file = new File([new Uint8Array([1])], "car.heic", {
      type: "image/heic",
    });
    await user.upload(screen.getByLabelText("Vehicle photo"), file);

    await waitFor(() => {
      expect(screen.getByTestId("vehicle-photo-error")).toHaveTextContent(
        "Use a JPEG, PNG, or WebP photo.",
      );
    });
  });
});
