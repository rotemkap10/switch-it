import { describe, expect, it } from "vitest";

import {
  isSeekerMapReadyForHandoffReturn,
  peekSeekerMapPresentation,
  reportSeekerMapPresentation,
  resetSeekerMapPresentationForTests,
  subscribeSeekerMapPresentation,
} from "@/lib/map/seeker-map-presentation";

const claimId = "11111111-1111-4111-8111-111111111111";

describe("seeker map presentation", () => {
  it("is not ready until the map has a usable frame", () => {
    resetSeekerMapPresentationForTests();
    reportSeekerMapPresentation({
      visuallyReady: false,
      activeClaimId: null,
    });
    expect(isSeekerMapReadyForHandoffReturn(claimId)).toBe(false);
  });

  it("is not ready while the completed claim is still on the map", () => {
    reportSeekerMapPresentation({
      visuallyReady: true,
      activeClaimId: claimId,
    });
    expect(isSeekerMapReadyForHandoffReturn(claimId)).toBe(false);
  });

  it("is ready when the map is painted and the completed claim is gone", () => {
    reportSeekerMapPresentation({
      visuallyReady: true,
      activeClaimId: null,
    });
    expect(isSeekerMapReadyForHandoffReturn(claimId)).toBe(true);
    expect(peekSeekerMapPresentation()).toEqual({
      visuallyReady: true,
      activeClaimId: null,
    });
  });

  it("notifies subscribers of presentation changes", () => {
    const seen: Array<{ visuallyReady: boolean; activeClaimId: string | null }> =
      [];
    const unsub = subscribeSeekerMapPresentation((next) => {
      seen.push(next);
    });
    reportSeekerMapPresentation({
      visuallyReady: true,
      activeClaimId: "other",
    });
    unsub();
    expect(seen.at(-1)).toEqual({
      visuallyReady: true,
      activeClaimId: "other",
    });
  });
});
