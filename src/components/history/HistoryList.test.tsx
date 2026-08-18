import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const loadMoreHistoryMock = vi.fn();

vi.mock("@/actions/history", () => ({
  loadMoreHistory: (...args: unknown[]) => loadMoreHistoryMock(...args),
}));

import { HistoryList } from "@/components/history/HistoryList";
import type { HistoryItem } from "@/lib/history/format";

const todayItem: HistoryItem = {
  id: "publisher:claim-uuid-aaa",
  role: "publisher",
  status: "completed",
  address: "Dizengoff St",
  atIso: new Date().toISOString(),
  creditDelta: 1,
};

const yesterdayItem: HistoryItem = {
  id: "seeker:claim-uuid-bbb",
  role: "seeker",
  status: "cancelled",
  address: null,
  atIso: new Date(Date.now() - 86_400_000).toISOString(),
  creditDelta: null,
};

describe("HistoryList", () => {
  beforeEach(() => {
    loadMoreHistoryMock.mockReset();
  });

  it("shows a lightweight empty state", () => {
    render(<HistoryList items={[]} />);
    expect(screen.getByTestId("history-empty")).toHaveTextContent(
      "No activity yet",
    );
    expect(screen.getByTestId("history-empty")).toHaveTextContent(
      "Parking handoffs you share or find will show up here.",
    );
    expect(screen.queryByTestId("history-load-more")).not.toBeInTheDocument();
  });

  it("renders friendly cards without raw ids, codes, or DB statuses", () => {
    render(<HistoryList items={[todayItem, yesterdayItem]} />);
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
    expect(
      screen.queryByRole("button", { name: "Load more" }),
    ).not.toBeInTheDocument();
  });

  it("merges the same calendar day into one section heading", () => {
    const items: HistoryItem[] = [
      {
        id: "a",
        role: "publisher",
        status: "completed",
        address: "First St",
        atIso: new Date(2026, 7, 15, 18, 0).toISOString(),
        creditDelta: 1,
      },
      {
        id: "b",
        role: "seeker",
        status: "expired",
        address: "Second St",
        atIso: new Date(2026, 7, 15, 9, 0).toISOString(),
        creditDelta: null,
      },
    ];

    render(<HistoryList items={items} />);
    expect(screen.getByText("You shared a spot")).toBeInTheDocument();
    expect(screen.getByText("You found a spot")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(1);
  });

  it("appends the next page, skips duplicates, and hides Load more when done", async () => {
    const user = userEvent.setup();
    loadMoreHistoryMock.mockResolvedValue({
      ok: true,
      items: [
        todayItem,
        yesterdayItem,
        {
          id: "seeker:claim-uuid-ccc",
          role: "seeker",
          status: "expired",
          address: "Rothschild Blvd",
          atIso: new Date(Date.now() - 2 * 86_400_000).toISOString(),
          creditDelta: null,
        },
      ],
      hasMore: false,
      nextCursor: null,
    });

    render(
      <HistoryList
        items={[todayItem]}
        hasMore
        nextCursor={{
          beforeAt: todayItem.atIso,
          beforeId: "claim-uuid-aaa",
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Load more" }));

    expect(loadMoreHistoryMock).toHaveBeenCalledWith({
      beforeAt: todayItem.atIso,
      beforeId: "claim-uuid-aaa",
    });
    expect(screen.getAllByText("You found a spot")).toHaveLength(2);
    expect(screen.getByText("Rothschild Blvd")).toBeInTheDocument();
    expect(screen.getByText(/Expired/)).toBeInTheDocument();
    expect(screen.getAllByText("You shared a spot")).toHaveLength(1);
    expect(
      screen.queryByRole("button", { name: "Load more" }),
    ).not.toBeInTheDocument();
  });

  it("keeps already loaded cards when Load more fails", async () => {
    const user = userEvent.setup();
    loadMoreHistoryMock.mockResolvedValue({
      ok: false,
      error: "Couldn’t load more handoffs. Please try again.",
    });

    render(
      <HistoryList
        items={[todayItem]}
        hasMore
        nextCursor={{
          beforeAt: todayItem.atIso,
          beforeId: "claim-uuid-aaa",
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Load more" }));

    expect(screen.getByText("You shared a spot")).toBeInTheDocument();
    expect(screen.getByText("Dizengoff St")).toBeInTheDocument();
    expect(screen.getByText("Couldn’t load more")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Load more" })).toBeEnabled();
  });
});
