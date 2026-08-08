import { describe, expect, it, beforeEach } from "vitest";

import {
  clearPostClaimNavigationOffer,
  initialPostClaimNavigationOpen,
  offerPostClaimNavigation,
  peekPostClaimNavigationPendingForTests,
  resetPostClaimNavigationForTests,
} from "@/lib/map/post-claim-navigation";

const claimA = "11111111-1111-4111-8111-111111111111";
const claimB = "22222222-2222-4222-8222-222222222222";

describe("post-claim navigation intent", () => {
  beforeEach(() => {
    resetPostClaimNavigationForTests();
  });

  it("offers only the just-claimed id", () => {
    offerPostClaimNavigation(claimA);
    expect(peekPostClaimNavigationPendingForTests()).toBe(claimA);
    expect(initialPostClaimNavigationOpen(claimB)).toBe(false);
    expect(initialPostClaimNavigationOpen(claimA)).toBe(true);
    expect(peekPostClaimNavigationPendingForTests()).toBeNull();
  });

  it("reuses the same start-open decision across remounts", () => {
    offerPostClaimNavigation(claimA);
    expect(initialPostClaimNavigationOpen(claimA)).toBe(true);
    expect(initialPostClaimNavigationOpen(claimA)).toBe(true);
  });

  it("does not auto-open an existing claim without a fresh offer", () => {
    expect(initialPostClaimNavigationOpen(claimA)).toBe(false);
    expect(initialPostClaimNavigationOpen(claimA)).toBe(false);
  });

  it("stays closed after dismiss even if remounted", () => {
    offerPostClaimNavigation(claimA);
    expect(initialPostClaimNavigationOpen(claimA)).toBe(true);
    clearPostClaimNavigationOffer(claimA);
    expect(initialPostClaimNavigationOpen(claimA)).toBe(false);
  });

  it("treats a later offer for the same claim as a new event", () => {
    offerPostClaimNavigation(claimA);
    expect(initialPostClaimNavigationOpen(claimA)).toBe(true);
    clearPostClaimNavigationOffer(claimA);
    offerPostClaimNavigation(claimA);
    expect(initialPostClaimNavigationOpen(claimA)).toBe(true);
  });
});
