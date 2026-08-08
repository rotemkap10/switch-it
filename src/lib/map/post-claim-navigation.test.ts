import { describe, expect, it, beforeEach, vi } from "vitest";

import {
  offerPostClaimNavigation,
  peekPostClaimNavigationPendingForTests,
  registerClaimSpotDestination,
  resetPostClaimNavigationForTests,
  subscribePostClaimNavigation,
  takeClaimSpotDestination,
  unregisterClaimSpotDestination,
} from "@/lib/map/post-claim-navigation";

const claimA = "11111111-1111-4111-8111-111111111111";
const destination = { latitude: 32.085312, longitude: 34.781812 };

describe("post-claim navigation intent bus", () => {
  beforeEach(() => {
    resetPostClaimNavigationForTests();
  });

  it("queues an offer until a listener subscribes", () => {
    offerPostClaimNavigation({ claimId: claimA, ...destination });
    expect(peekPostClaimNavigationPendingForTests()).toEqual({
      claimId: claimA,
      ...destination,
    });

    const received: unknown[] = [];
    const unsubscribe = subscribePostClaimNavigation((offer) => {
      received.push(offer);
    });
    expect(received).toEqual([{ claimId: claimA, ...destination }]);
    expect(peekPostClaimNavigationPendingForTests()).toBeNull();
    unsubscribe();
  });

  it("delivers immediately when a listener is already subscribed", () => {
    const listener = vi.fn();
    const unsubscribe = subscribePostClaimNavigation(listener);
    offerPostClaimNavigation({ claimId: claimA, ...destination });
    expect(listener).toHaveBeenCalledWith({ claimId: claimA, ...destination });
    expect(peekPostClaimNavigationPendingForTests()).toBeNull();
    unsubscribe();
  });

  it("ignores invalid coordinates", () => {
    const listener = vi.fn();
    const unsubscribe = subscribePostClaimNavigation(listener);
    offerPostClaimNavigation({ claimId: claimA, latitude: 91, longitude: 34 });
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("registers claim destinations for the claim action wrapper", () => {
    registerClaimSpotDestination("spot-1", 32.1, 34.2);
    expect(takeClaimSpotDestination("spot-1")).toEqual({
      latitude: 32.1,
      longitude: 34.2,
    });
    unregisterClaimSpotDestination("spot-1");
    expect(takeClaimSpotDestination("spot-1")).toBeNull();
  });
});
