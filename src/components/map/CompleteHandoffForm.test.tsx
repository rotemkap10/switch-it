import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { completeClaimMock } = vi.hoisted(() => ({
  completeClaimMock: vi.fn(),
}));

vi.mock("@/actions/claims", () => ({
  completeClaim: completeClaimMock,
}));

import { CompleteHandoffForm } from "@/components/map/CompleteHandoffForm";
import { FeedbackShell } from "@/components/feedback/FeedbackShell";
import { completeClaimSchema } from "@/lib/validations/claim";
import {
  resetSensoryAdaptersForTests,
  setSensoryAdaptersForTests,
} from "@/lib/sensory/feedback";
import { resetSensoryOnceForTests } from "@/lib/sensory/once";

const claimId = "11111111-1111-4111-8111-111111111111";

function fieldErrorsFromZod(error: import("zod").ZodError) {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    fieldErrors[key] ??= [];
    fieldErrors[key].push(issue.message);
  }
  return fieldErrors;
}

function mockCompleteWithSchemaValidation() {
  completeClaimMock.mockImplementation(
    async (_prev: unknown, formData: FormData) => {
      const parsed = completeClaimSchema.safeParse({
        claim_id: formData.get("claim_id"),
        plate_suffix: formData.get("plate_suffix"),
      });

      if (!parsed.success) {
        return { fieldErrors: fieldErrorsFromZod(parsed.error) };
      }

      return { success: true, claimId: parsed.data.claim_id };
    },
  );
}

async function enterPlateSuffix(
  user: ReturnType<typeof userEvent.setup>,
  digits: string,
) {
  await user.type(
    screen.getByRole("textbox", { name: "Last 2 digits" }),
    digits,
  );
}

describe("CompleteHandoffForm", () => {
  beforeEach(() => {
    completeClaimMock.mockReset();
    mockCompleteWithSchemaValidation();
    resetSensoryOnceForTests();
    resetSensoryAdaptersForTests();
  });

  function renderForm() {
    return render(
      <FeedbackShell>
        <CompleteHandoffForm claimId={claimId} />
      </FeedbackShell>,
    );
  }

  it("shows plate-digit verification instead of the spoken handoff code", () => {
    renderForm();

    expect(screen.getByText("Confirm the vehicle")).toBeInTheDocument();
    expect(screen.getByText("Last 2 digits")).toBeInTheDocument();
    expect(
      screen.queryByText("Enter the 2 hidden digits from the license plate."),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Hidden plate digits")).not.toBeInTheDocument();
    expect(screen.queryByText("Handoff code")).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        "Once you’re safely stopped, enter the code to complete the handoff.",
      ),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Complete handoff" }),
    ).toBeInTheDocument();
    const suffix = screen.getByTestId("plate-suffix-input");
    expect(suffix).not.toHaveFocus();
    expect(suffix).not.toHaveAttribute("autoFocus");
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
  });

  it("does not autofocus the plate suffix on the active handoff form", () => {
    renderForm();

    expect(screen.getByTestId("plate-suffix-input")).not.toHaveFocus();
    expect(document.activeElement).not.toBe(
      screen.getByTestId("plate-suffix-input"),
    );
  });

  it("does not refocus the suffix input after a validation error", async () => {
    const user = userEvent.setup();
    renderForm();

    await enterPlateSuffix(user, "6");
    await user.click(
      screen.getByRole("button", { name: "Complete handoff" }),
    );

    await waitFor(() => {
      expect(screen.getByText("Enter the last 2 digits.")).toBeInTheDocument();
    });
    expect(screen.getByTestId("plate-suffix-input")).not.toHaveFocus();
  });

  it("submits claim_id and plate_suffix only", async () => {
    const user = userEvent.setup();
    renderForm();

    await enterPlateSuffix(user, "67");
    await user.click(
      screen.getByRole("button", { name: "Complete handoff" }),
    );

    await waitFor(() => {
      expect(completeClaimMock).toHaveBeenCalled();
    });

    const formData = completeClaimMock.mock.calls.at(-1)?.[1] as FormData;
    expect(formData.get("claim_id")).toBe(claimId);
    expect(formData.get("plate_suffix")).toBe("67");
    expect(formData.get("handoff_code")).toBeNull();
    expect(formData.get("owner_id")).toBeNull();
    expect(formData.get("credits")).toBeNull();
  });

  it("shows validation feedback for a single digit", async () => {
    const user = userEvent.setup();
    renderForm();

    await enterPlateSuffix(user, "6");
    await user.click(
      screen.getByRole("button", { name: "Complete handoff" }),
    );

    await waitFor(() => {
      expect(screen.getByText("Enter the last 2 digits.")).toBeInTheDocument();
    });
  });

  it("emphasizes Complete handoff without changing verification fields", () => {
    render(
      <FeedbackShell>
        <CompleteHandoffForm claimId={claimId} emphasized />
      </FeedbackShell>,
    );

    expect(screen.getByText("Last 2 digits")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Complete handoff" });
    expect(button).toHaveAttribute("data-emphasized", "true");
    expect(button.className).toContain("border-accent");
    expect(button.className).toContain("border-2");
    expect(button.className).toContain("min-h-[var(--app-tap-min)]");
  });

  it("calls onCompleted after successful verification", async () => {
    const onCompleted = vi.fn();
    const user = userEvent.setup();
    render(
      <FeedbackShell>
        <CompleteHandoffForm claimId={claimId} onCompleted={onCompleted} />
      </FeedbackShell>,
    );

    await enterPlateSuffix(user, "67");
    await user.click(
      screen.getByRole("button", { name: "Complete handoff" }),
    );

    await waitFor(() => {
      expect(onCompleted).toHaveBeenCalledTimes(1);
    });
  });

  it("plays completion feedback once and still completes if sensory fails", async () => {
    const playSound = vi.fn(() => {
      throw new Error("audio failed");
    });
    const haptic = vi.fn();
    setSensoryAdaptersForTests({ playSound, haptic });

    const onCompleted = vi.fn();
    const user = userEvent.setup();
    render(
      <FeedbackShell>
        <CompleteHandoffForm claimId={claimId} onCompleted={onCompleted} />
      </FeedbackShell>,
    );

    await enterPlateSuffix(user, "67");
    await user.click(
      screen.getByRole("button", { name: "Complete handoff" }),
    );

    await waitFor(() => {
      expect(onCompleted).toHaveBeenCalledTimes(1);
    });
    expect(playSound).toHaveBeenCalledTimes(1);
  });

  it("does not play completion feedback for an already-completed handoff", async () => {
    completeClaimMock.mockResolvedValue({
      success: true,
      claimId,
      alreadyCompleted: true,
    });
    const playSound = vi.fn();
    setSensoryAdaptersForTests({ playSound, haptic: vi.fn() });

    const user = userEvent.setup();
    render(
      <FeedbackShell>
        <CompleteHandoffForm claimId={claimId} />
      </FeedbackShell>,
    );

    await enterPlateSuffix(user, "67");
    await user.click(
      screen.getByRole("button", { name: "Complete handoff" }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("handoff-complete-status")).toBeInTheDocument();
    });
    expect(playSound).not.toHaveBeenCalled();
  });
});
