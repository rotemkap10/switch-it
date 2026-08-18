import { describe, expect, it } from "vitest";

import {
  resolvePublisherSpotView,
  toPublisherSpot,
} from "@/lib/spots/publisher-spot-view";

const claimedRow = {
  id: "a0a29c9b-3257-4702-aa68-5edeaabe076c",
  status: "claimed",
  available_at: "2026-08-17T09:00:00.000Z",
  expires_at: "2026-08-17T09:06:00.000Z",
  handoff_started_at: "2026-08-17T09:03:00.000Z",
  handoff_extension_used_at: null,
  address: "Test St",
  latitude: 32.1,
  longitude: 34.8,
};

describe("toPublisherSpot", () => {
  it("accepts numeric coordinates as strings", () => {
    const spot = toPublisherSpot({
      ...claimedRow,
      latitude: "32.1",
      longitude: "34.8",
    });
    expect(spot?.latitude).toBe(32.1);
    expect(spot?.longitude).toBe(34.8);
  });
});

describe("resolvePublisherSpotView", () => {
  it("keeps the handoff card when a refresh fails", () => {
    const spot = toPublisherSpot(claimedRow);
    const view = resolvePublisherSpotView({ loadFailed: true, spot });
    expect(view.showCompose).toBe(false);
    expect(view.showLoadError).toBe(true);
    expect(view.layout).toBe("default");
    expect(view.spot?.id).toBe(claimedRow.id);
  });

  it("does not switch to compose when the open-spot fetch fails with no row", () => {
    const view = resolvePublisherSpotView({ loadFailed: true, spot: null });
    expect(view.showCompose).toBe(false);
    expect(view.showLoadError).toBe(true);
    expect(view.layout).toBe("default");
  });

  it("shows compose only when there is confirmed no open spot", () => {
    const view = resolvePublisherSpotView({ loadFailed: false, spot: null });
    expect(view.showCompose).toBe(true);
    expect(view.layout).toBe("map");
  });
});
