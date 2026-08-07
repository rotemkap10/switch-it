import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { extendHandoffWaitMock, refreshMock } = vi.hoisted(() => ({
  extendHandoffWaitMock: vi.fn(),
  refreshMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock, push: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("@/actions/claims", () => ({
  extendHandoffWait: extendHandoffWaitMock,
}));

import { ExtendHandoffWaitButton } from "@/components/spots/ExtendHandoffWaitButton";
import { FeedbackShell } from "@/components/feedback/FeedbackShell";

describe("ExtendHandoffWaitButton", () => {
  beforeEach(() => {
    extendHandoffWaitMock.mockReset();
    refreshMock.mockReset();
    extendHandoffWaitMock.mockResolvedValue({
      success: true,
      changed: true,
      expiresAt: "2026-08-04T22:49:00.000Z",
      hardCapAt: "2026-08-04T22:50:00.000Z",
      extendedBySeconds: 120,
    });
  });

  it("submits claim_id and refreshes after a successful extension", async () => {
    const user = userEvent.setup();
    render(
      <FeedbackShell>
        <ExtendHandoffWaitButton
          claimId="11111111-1111-4111-8111-111111111111"
          availableAtIso="2026-08-04T22:45:00.000Z"
          expiresAtIso="2026-08-04T22:47:00.000Z"
        />
      </FeedbackShell>,
    );

    await user.click(
      screen.getByRole("button", { name: "Wait 2 more min" }),
    );

    await waitFor(() => {
      expect(extendHandoffWaitMock).toHaveBeenCalled();
    });

    const formData = extendHandoffWaitMock.mock.calls[0]?.[1] as FormData;
    expect(formData.get("claim_id")).toBe(
      "11111111-1111-4111-8111-111111111111",
    );

    await waitFor(() => {
      expect(refreshMock).toHaveBeenCalled();
    });
  });

  it("hides when no extension headroom remains", () => {
    render(
      <FeedbackShell>
        <ExtendHandoffWaitButton
          claimId="11111111-1111-4111-8111-111111111111"
          availableAtIso="2026-08-04T22:45:00.000Z"
          expiresAtIso="2026-08-04T22:50:00.000Z"
        />
      </FeedbackShell>,
    );

    expect(screen.queryByTestId("extend-handoff-wait")).not.toBeInTheDocument();
  });

  it("labels a one-minute remaining extension truthfully", () => {
    render(
      <FeedbackShell>
        <ExtendHandoffWaitButton
          claimId="11111111-1111-4111-8111-111111111111"
          availableAtIso="2026-08-04T22:45:00.000Z"
          expiresAtIso="2026-08-04T22:49:00.000Z"
        />
      </FeedbackShell>,
    );

    expect(
      screen.getByRole("button", { name: "Wait 1 more min" }),
    ).toBeInTheDocument();
  });
});
