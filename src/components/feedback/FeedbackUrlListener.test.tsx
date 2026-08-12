import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const replaceMock = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/spots/new",
  useRouter: () => ({
    replace: replaceMock,
  }),
  useSearchParams: () => new URLSearchParams("feedback=spot-published"),
}));

import { AppFeedbackRoot } from "@/components/feedback/AppFeedbackRoot";
import {
  resetSensoryAdaptersForTests,
  setSensoryAdaptersForTests,
} from "@/lib/sensory/feedback";

describe("FeedbackUrlListener", () => {
  it("shows an allowlisted success toast and cleans the URL", async () => {
    const playSound = vi.fn();
    const haptic = vi.fn();
    setSensoryAdaptersForTests({ playSound, haptic });

    render(
      <AppFeedbackRoot>
        <div>Publisher page</div>
      </AppFeedbackRoot>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("feedback-toast-success")).toHaveTextContent(
        "Your parking spot is live.",
      );
    });

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/spots/new", { scroll: false });
    });

    expect(playSound).toHaveBeenCalledWith("success");
    expect(haptic).toHaveBeenCalledWith("success");
    resetSensoryAdaptersForTests();
  });
});
