import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { extendHandoffWaitMock } = vi.hoisted(() => ({
  extendHandoffWaitMock: vi.fn(),
}));

vi.mock("@/actions/claims", () => ({
  extendHandoffWait: extendHandoffWaitMock,
}));

import { ExtendHandoffWaitButton } from "@/components/spots/ExtendHandoffWaitButton";
import { FeedbackShell } from "@/components/feedback/FeedbackShell";

describe("ExtendHandoffWaitButton", () => {
  beforeEach(() => {
    extendHandoffWaitMock.mockReset();
    extendHandoffWaitMock.mockResolvedValue({
      success: true,
      changed: true,
      expiresAt: "2026-08-04T22:49:00.000Z",
      hardCapAt: "2026-08-04T22:50:00.000Z",
      extendedBySeconds: 120,
    });
  });

  it("submits claim_id and reports the new deadline to the parent", async () => {
    const user = userEvent.setup();
    const onExtended = vi.fn();
    render(
      <FeedbackShell>
        <ExtendHandoffWaitButton
          claimId="11111111-1111-4111-8111-111111111111"
          handoffStartedAtIso="2026-08-04T22:45:00.000Z"
          expiresAtIso="2026-08-04T22:47:00.000Z"
          onExtended={onExtended}
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
      expect(onExtended).toHaveBeenCalledWith({
        expiresAt: "2026-08-04T22:49:00.000Z",
        extensionUsedAt: "2026-08-04T22:49:00.000Z",
      });
    });
  });

  it("hides when no extension headroom remains", () => {
    render(
      <FeedbackShell>
        <ExtendHandoffWaitButton
          claimId="11111111-1111-4111-8111-111111111111"
          handoffStartedAtIso="2026-08-04T22:45:00.000Z"
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
          handoffStartedAtIso="2026-08-04T22:45:00.000Z"
          expiresAtIso="2026-08-04T22:49:00.000Z"
        />
      </FeedbackShell>,
    );

    expect(
      screen.getByRole("button", { name: "Wait 1 more min" }),
    ).toBeInTheDocument();
  });
});
