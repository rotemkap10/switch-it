import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HistoryList } from "@/components/history/HistoryList";
import type { HistoryItem } from "@/lib/history/format";

describe("HistoryList", () => {
  it("shows a lightweight empty state", () => {
    render(<HistoryList items={[]} />);
    expect(screen.getByTestId("history-empty")).toHaveTextContent(
      "No activity yet",
    );
  });

  it("renders friendly cards without raw ids, codes, or DB statuses", () => {
    const items: HistoryItem[] = [
      {
        id: "publisher:claim-uuid-aaa",
        role: "publisher",
        status: "completed",
        address: "Dizengoff St",
        atIso: new Date().toISOString(),
        creditDelta: 1,
      },
      {
        id: "seeker:claim-uuid-bbb",
        role: "seeker",
        status: "cancelled",
        address: null,
        atIso: new Date(Date.now() - 86_400_000).toISOString(),
        creditDelta: null,
      },
    ];

    render(<HistoryList items={items} />);
    expect(screen.getByText("You shared a spot")).toBeInTheDocument();
    expect(screen.getByText("You found a spot")).toBeInTheDocument();
    expect(screen.getByText("Parking location")).toBeInTheDocument();
    expect(screen.getByText(/Completed/)).toBeInTheDocument();
    expect(screen.getByText(/Cancelled/)).toBeInTheDocument();
    expect(screen.getByText(/\+1 credit/)).toBeInTheDocument();
    expect(screen.getByText(/No credit change/)).toBeInTheDocument();
    expect(screen.queryByText("completed")).not.toBeInTheDocument();
    expect(screen.queryByText("cancelled")).not.toBeInTheDocument();
    expect(screen.queryByText(/claim-uuid/)).not.toBeInTheDocument();
    expect(screen.queryByText(/handoff/i)).not.toBeInTheDocument();
  });
});
