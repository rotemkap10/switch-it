import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const checkPermissions = vi.fn();
const requestPermissions = vi.fn();
const register = vi.fn();
const addListener = vi.fn();
const getPlatform = vi.fn(() => "android");

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => true,
    getPlatform: () => getPlatform(),
    isPluginAvailable: () => true,
  },
}));

vi.mock("@capacitor/push-notifications", () => ({
  PushNotifications: {
    checkPermissions: (...args: unknown[]) => checkPermissions(...args),
    requestPermissions: (...args: unknown[]) => requestPermissions(...args),
    register: (...args: unknown[]) => register(...args),
    addListener: (...args: unknown[]) => addListener(...args),
    removeAllListeners: vi.fn(),
  },
}));

vi.mock("@/lib/push/register-device", () => ({
  uploadPushDeviceToken: vi.fn(),
  disableCurrentPushDevice: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

import { HandoffPushController } from "@/components/push/HandoffPushController";
import { resetHandoffPushPrepromptShownForTests } from "@/lib/push/preprompt-storage";

describe("HandoffPushController", () => {
  beforeEach(() => {
    resetHandoffPushPrepromptShownForTests();
    getPlatform.mockReturnValue("android");
    checkPermissions.mockReset();
    requestPermissions.mockReset();
    register.mockReset();
    addListener.mockResolvedValue({ remove: vi.fn() });
    checkPermissions.mockResolvedValue({ receive: "prompt" });
    requestPermissions.mockResolvedValue({ receive: "granted" });
    register.mockResolvedValue(undefined);
  });

  describe("iOS Personal Team (APNs gated off)", () => {
    beforeEach(() => {
      getPlatform.mockReturnValue("ios");
    });

    it("does not show the preprompt, OS prompt, or notifications-off banner", async () => {
      render(<HandoffPushController userId="user-1" hasActiveHandoff />);
      await Promise.resolve();
      expect(requestPermissions).not.toHaveBeenCalled();
      expect(register).not.toHaveBeenCalled();
      expect(checkPermissions).not.toHaveBeenCalled();
      expect(
        screen.queryByTestId("handoff-push-preprompt"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("handoff-push-notifications-off"),
      ).not.toBeInTheDocument();
    });
  });

  describe("Android", () => {
    it("does not request OS permission on launch", async () => {
      render(
        <HandoffPushController userId="user-1" hasActiveHandoff={false} />,
      );
      await Promise.resolve();
      expect(requestPermissions).not.toHaveBeenCalled();
      expect(register).not.toHaveBeenCalled();
      expect(
        screen.queryByTestId("handoff-push-preprompt"),
      ).not.toBeInTheDocument();
    });

    it("shows the explanatory prompt on the first active handoff", async () => {
      render(<HandoffPushController userId="user-1" hasActiveHandoff />);
      expect(
        await screen.findByTestId("handoff-push-preprompt"),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: /Stay updated during your handoff/i }),
      ).toBeInTheDocument();
      expect(requestPermissions).not.toHaveBeenCalled();
    });

    it("Not now does not request OS permission", async () => {
      const user = userEvent.setup();
      render(<HandoffPushController userId="user-1" hasActiveHandoff />);
      await screen.findByTestId("handoff-push-preprompt");
      await user.click(screen.getByRole("button", { name: "Not now" }));
      expect(requestPermissions).not.toHaveBeenCalled();
      expect(register).not.toHaveBeenCalled();
      expect(
        screen.queryByTestId("handoff-push-preprompt"),
      ).not.toBeInTheDocument();
    });

    it("Enable notifications requests permission and registers", async () => {
      const user = userEvent.setup();
      render(<HandoffPushController userId="user-1" hasActiveHandoff />);
      await screen.findByTestId("handoff-push-preprompt");
      await user.click(
        screen.getByRole("button", { name: "Enable notifications" }),
      );
      expect(requestPermissions).toHaveBeenCalledTimes(1);
      expect(register).toHaveBeenCalledTimes(1);
    });

    it("registers when permission is already granted without showing the OS prompt", async () => {
      checkPermissions.mockResolvedValue({ receive: "granted" });
      render(
        <HandoffPushController userId="user-1" hasActiveHandoff={false} />,
      );
      await waitFor(() => expect(register).toHaveBeenCalledTimes(1));
      expect(requestPermissions).not.toHaveBeenCalled();
      expect(
        screen.queryByTestId("handoff-push-preprompt"),
      ).not.toBeInTheDocument();
    });

    it("does not re-show the OS prompt after denial", async () => {
      checkPermissions.mockResolvedValue({ receive: "denied" });
      render(<HandoffPushController userId="user-1" hasActiveHandoff />);
      expect(
        await screen.findByTestId("handoff-push-notifications-off"),
      ).toBeInTheDocument();
      expect(requestPermissions).not.toHaveBeenCalled();
      expect(
        screen.queryByTestId("handoff-push-preprompt"),
      ).not.toBeInTheDocument();
    });
  });
});
