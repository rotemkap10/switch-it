import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FeedbackShell } from "@/components/feedback/FeedbackShell";
import { useFeedback } from "@/components/feedback/FeedbackProvider";

function FeedbackProbe() {
  const feedback = useFeedback();
  return (
    <div>
      <button type="button" onClick={() => feedback.success("Vehicle added.")}>
        Push success
      </button>
      <button
        type="button"
        onClick={() => feedback.error("That handoff code isn’t correct.")}
      >
        Push error
      </button>
      <button
        type="button"
        onClick={() => {
          feedback.info("One");
          feedback.info("Two");
          feedback.info("Three");
        }}
      >
        Push many
      </button>
    </div>
  );
}

describe("FeedbackProvider", () => {
  it("renders success and error toasts with live regions", async () => {
    const user = userEvent.setup();
    render(
      <FeedbackShell>
        <FeedbackProbe />
      </FeedbackShell>,
    );

    await user.click(screen.getByRole("button", { name: "Push success" }));
    const success = screen.getByTestId("feedback-toast-success");
    expect(success).toHaveAttribute("role", "status");
    expect(success).toHaveAttribute("aria-live", "polite");
    expect(success).toHaveTextContent("Vehicle added.");

    await user.click(screen.getByRole("button", { name: "Push error" }));
    const error = screen.getByTestId("feedback-toast-error");
    expect(error).toHaveAttribute("role", "alert");
    expect(error).toHaveTextContent("That handoff code isn’t correct.");
  });

  it("dismisses a toast manually", async () => {
    const user = userEvent.setup();
    render(
      <FeedbackShell>
        <FeedbackProbe />
      </FeedbackShell>,
    );

    await user.click(screen.getByRole("button", { name: "Push success" }));
    await user.click(screen.getByRole("button", { name: "Dismiss notification" }));
    expect(screen.queryByTestId("feedback-toast-success")).not.toBeInTheDocument();
  });

  it("keeps at most two toasts in the queue", async () => {
    const user = userEvent.setup();
    render(
      <FeedbackShell>
        <FeedbackProbe />
      </FeedbackShell>,
    );

    await user.click(screen.getByRole("button", { name: "Push many" }));
    expect(screen.getAllByTestId(/feedback-toast-/)).toHaveLength(2);
    expect(screen.getByText("Two")).toBeInTheDocument();
    expect(screen.getByText("Three")).toBeInTheDocument();
    expect(screen.queryByText("One")).not.toBeInTheDocument();
  });

  it("auto-dismisses success toasts with fake timers", () => {
    vi.useFakeTimers();

    function AutoSuccess() {
      const feedback = useFeedback();
      return (
        <button
          type="button"
          onClick={() => feedback.success("Vehicle added.")}
        >
          Push success
        </button>
      );
    }

    render(
      <FeedbackShell>
        <AutoSuccess />
      </FeedbackShell>,
    );

    act(() => {
      screen.getByRole("button", { name: "Push success" }).click();
    });
    expect(screen.getByTestId("feedback-toast-success")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(screen.queryByTestId("feedback-toast-success")).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});
