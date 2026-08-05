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
import { completeClaimSchema } from "@/lib/validations/claim";

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
        handoff_code: formData.get("handoff_code"),
      });

      if (!parsed.success) {
        return { fieldErrors: fieldErrorsFromZod(parsed.error) };
      }

      return { success: true, claimId: parsed.data.claim_id };
    },
  );
}

describe("CompleteHandoffForm", () => {
  beforeEach(() => {
    completeClaimMock.mockReset();
    mockCompleteWithSchemaValidation();
  });

  it("shows the verification form instead of the old direct completion button", () => {
    render(<CompleteHandoffForm claimId={claimId} />);

    expect(screen.getByText("Complete the handoff")).toBeInTheDocument();
    expect(
      screen.getByText("Ask the driver for the 5-digit handoff code."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Verify and complete" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "I got the spot" }),
    ).not.toBeInTheDocument();
  });

  it("submits claim_id and handoff_code only", async () => {
    const user = userEvent.setup();
    render(<CompleteHandoffForm claimId={claimId} />);

    await user.type(screen.getByLabelText("Handoff code"), "12345");
    await user.click(
      screen.getByRole("button", { name: "Verify and complete" }),
    );

    await waitFor(() => {
      expect(completeClaimMock).toHaveBeenCalled();
    });

    const formData = completeClaimMock.mock.calls.at(-1)?.[1] as FormData;
    expect(formData.get("claim_id")).toBe(claimId);
    expect(formData.get("handoff_code")).toBe("12345");
    expect(formData.get("owner_id")).toBeNull();
    expect(formData.get("credits")).toBeNull();
  });

  it("shows validation feedback for invalid codes", async () => {
    const user = userEvent.setup();
    render(<CompleteHandoffForm claimId={claimId} />);

    await user.type(screen.getByLabelText("Handoff code"), "1234");
    await user.click(
      screen.getByRole("button", { name: "Verify and complete" }),
    );

    await waitFor(() => {
      expect(
        screen.getByText("Enter a 5-digit handoff code."),
      ).toBeInTheDocument();
    });
  });

  it("shows lockout and invalid-code messages from the action", async () => {
    completeClaimMock.mockResolvedValueOnce({
      error: "That code didn't match. Check with the driver and try again.",
    });

    const user = userEvent.setup();
    render(<CompleteHandoffForm claimId={claimId} />);

    await user.type(screen.getByLabelText("Handoff code"), "99999");
    await user.click(
      screen.getByRole("button", { name: "Verify and complete" }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/That code didn't match/i),
      ).toBeInTheDocument();
    });

    completeClaimMock.mockResolvedValueOnce({
      error: "Too many attempts. Try again shortly.",
      lockout: true,
    });

    await user.click(
      screen.getByRole("button", { name: "Verify and complete" }),
    );

    await waitFor(() => {
      expect(
        screen.getByText("Too many attempts. Try again shortly."),
      ).toBeInTheDocument();
    });
  });
});
