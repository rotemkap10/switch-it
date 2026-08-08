import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  uploadVehiclePhotoToStorageMock,
  removeUploadedVehiclePhotoMock,
  saveVehiclePhotoPathMock,
  removeVehiclePhotoMock,
} = vi.hoisted(() => ({
  uploadVehiclePhotoToStorageMock: vi.fn(),
  removeUploadedVehiclePhotoMock: vi.fn(),
  saveVehiclePhotoPathMock: vi.fn(),
  removeVehiclePhotoMock: vi.fn(),
}));

vi.mock("@/lib/vehicle/upload-vehicle-photo-client", () => ({
  uploadVehiclePhotoToStorage: uploadVehiclePhotoToStorageMock,
  removeUploadedVehiclePhoto: removeUploadedVehiclePhotoMock,
}));

vi.mock("@/actions/vehicle-photo", () => ({
  saveVehiclePhotoPath: saveVehiclePhotoPathMock,
  removeVehiclePhoto: removeVehiclePhotoMock,
}));

import { VehiclePhotoControls } from "@/components/vehicle/VehiclePhotoControls";
import {
  VEHICLE_PHOTO_TIMEOUT_MESSAGE,
  VEHICLE_PHOTO_TOO_LARGE_MESSAGE,
  VEHICLE_PHOTO_UNSUPPORTED_MESSAGE,
} from "@/lib/vehicle/photo";

function jpegFile() {
  return new File(
    [new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4])],
    "car.jpg",
    { type: "image/jpeg" },
  );
}

describe("VehiclePhotoControls", () => {
  beforeEach(() => {
    uploadVehiclePhotoToStorageMock.mockReset();
    removeUploadedVehiclePhotoMock.mockReset();
    saveVehiclePhotoPathMock.mockReset();
    removeVehiclePhotoMock.mockReset();
  });

  it("lets a user add a photo without requiring it", async () => {
    const user = userEvent.setup();
    const onPhotoChange = vi.fn();
    uploadVehiclePhotoToStorageMock.mockResolvedValue({
      ok: true,
      photoPath: "user/photo.jpg",
    });
    saveVehiclePhotoPathMock.mockResolvedValue({
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

    await user.upload(screen.getByLabelText("Vehicle photo"), jpegFile());

    await waitFor(() => {
      expect(uploadVehiclePhotoToStorageMock).toHaveBeenCalled();
      expect(saveVehiclePhotoPathMock).toHaveBeenCalledWith("user/photo.jpg");
    });
    expect(onPhotoChange).toHaveBeenCalledWith({
      photoPath: "user/photo.jpg",
      photoUrl: "https://example.test/photo.jpg",
    });
    expect(screen.queryByText("Uploading…")).not.toBeInTheDocument();
  });

  it("rejects HEIC immediately without uploading or showing Uploading", async () => {
    render(<VehiclePhotoControls />);

    const heic = new File(
      [
        new Uint8Array([
          0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63,
        ]),
      ],
      "IMG_1000.HEIC",
      { type: "image/heic" },
    );
    // iOS photo library often ignores `accept`; simulate selecting HEIC anyway.
    fireEvent.change(screen.getByLabelText("Vehicle photo"), {
      target: { files: [heic] },
    });

    await waitFor(() => {
      expect(screen.getByTestId("vehicle-photo-error")).toHaveTextContent(
        VEHICLE_PHOTO_UNSUPPORTED_MESSAGE,
      );
    });
    expect(uploadVehiclePhotoToStorageMock).not.toHaveBeenCalled();
    expect(saveVehiclePhotoPathMock).not.toHaveBeenCalled();
    expect(screen.queryByText("Uploading…")).not.toBeInTheDocument();
  });

  it("rejects files over 5 MB immediately without uploading", async () => {
    const user = userEvent.setup();
    render(<VehiclePhotoControls />);

    const huge = new File([new Uint8Array([0xff, 0xd8, 0xff])], "huge.jpg", {
      type: "image/jpeg",
    });
    Object.defineProperty(huge, "size", { value: 5 * 1024 * 1024 + 1 });
    await user.upload(screen.getByLabelText("Vehicle photo"), huge);

    await waitFor(() => {
      expect(screen.getByTestId("vehicle-photo-error")).toHaveTextContent(
        VEHICLE_PHOTO_TOO_LARGE_MESSAGE,
      );
    });
    expect(uploadVehiclePhotoToStorageMock).not.toHaveBeenCalled();
    expect(saveVehiclePhotoPathMock).not.toHaveBeenCalled();
    expect(screen.queryByText("Uploading…")).not.toBeInTheDocument();
  });

  it("clears Uploading and shows an error when Storage upload fails", async () => {
    const user = userEvent.setup();
    uploadVehiclePhotoToStorageMock.mockResolvedValue({
      ok: false,
      error: "Could not upload your vehicle photo.",
    });

    render(<VehiclePhotoControls />);
    await user.upload(screen.getByLabelText("Vehicle photo"), jpegFile());

    await waitFor(() => {
      expect(screen.getByTestId("vehicle-photo-error")).toHaveTextContent(
        "Could not upload your vehicle photo.",
      );
    });
    expect(saveVehiclePhotoPathMock).not.toHaveBeenCalled();
    expect(screen.queryByText("Uploading…")).not.toBeInTheDocument();
  });

  it("clears Uploading when Storage times out", async () => {
    const user = userEvent.setup();
    uploadVehiclePhotoToStorageMock.mockResolvedValue({
      ok: false,
      error: VEHICLE_PHOTO_TIMEOUT_MESSAGE,
    });

    render(<VehiclePhotoControls />);
    await user.upload(screen.getByLabelText("Vehicle photo"), jpegFile());

    await waitFor(() => {
      expect(screen.getByTestId("vehicle-photo-error")).toHaveTextContent(
        VEHICLE_PHOTO_TIMEOUT_MESSAGE,
      );
    });
    expect(screen.queryByText("Uploading…")).not.toBeInTheDocument();
  });

  it("clears Uploading and removes the orphan when saving the path fails", async () => {
    const user = userEvent.setup();
    uploadVehiclePhotoToStorageMock.mockResolvedValue({
      ok: true,
      photoPath: "user/photo.jpg",
    });
    saveVehiclePhotoPathMock.mockResolvedValue({
      success: false,
      error: "Could not save your vehicle photo.",
    });

    render(<VehiclePhotoControls />);
    await user.upload(screen.getByLabelText("Vehicle photo"), jpegFile());

    await waitFor(() => {
      expect(screen.getByTestId("vehicle-photo-error")).toHaveTextContent(
        "Could not save your vehicle photo.",
      );
    });
    expect(removeUploadedVehiclePhotoMock).toHaveBeenCalledWith("user/photo.jpg");
    expect(screen.queryByText("Uploading…")).not.toBeInTheDocument();
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
});
