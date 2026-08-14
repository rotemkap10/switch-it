import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("handoff live-location pipeline contracts", () => {
  const root = process.cwd();

  it("sender and receiver share getClaimLocationTopic", () => {
    const publisher = readFileSync(
      resolve(root, "src/lib/location/use-publisher-live-location.ts"),
      "utf8",
    );
    const seeker = readFileSync(
      resolve(root, "src/lib/location/use-seeker-live-location-share.ts"),
      "utf8",
    );
    const native = readFileSync(
      resolve(root, "src/lib/location/handoff-native-broadcast.ts"),
      "utf8",
    );
    const edge = readFileSync(
      resolve(root, "supabase/functions/handoff-seeker-location/index.ts"),
      "utf8",
    );

    expect(publisher).toContain("getClaimLocationTopic");
    expect(seeker).toContain("getClaimLocationTopic");
    expect(native).toContain("getClaimLocationTopic");
    expect(edge).toContain("getClaimLocationTopic");
    expect(edge).toContain("../_shared/claim-location-topic.ts");
  });

  it("Edge Function broadcasts with the seeker JWT, not the service role", () => {
    const edge = readFileSync(
      resolve(root, "supabase/functions/handoff-seeker-location/index.ts"),
      "utf8",
    );
    expect(edge).toContain("Authorization: `Bearer ${jwt}`");
    expect(edge).not.toContain("Authorization: `Bearer ${serviceKey}`");
  });

  it("does not persist a location history table or queue", () => {
    const seeker = readFileSync(
      resolve(root, "src/lib/location/use-seeker-live-location-share.ts"),
      "utf8",
    );
    const publisher = readFileSync(
      resolve(root, "src/lib/location/use-publisher-live-location.ts"),
      "utf8",
    );
    const edge = readFileSync(
      resolve(root, "supabase/functions/handoff-seeker-location/index.ts"),
      "utf8",
    );
    expect(seeker).toContain("Do not queue history");
    expect(publisher).toContain("never persisted");
    expect(edge).toContain("No location history is stored");
  });

  it("native sharing starts from the claim session, not a navigation button", () => {
    const experience = readFileSync(
      resolve(root, "src/components/map/SeekerMapExperience.tsx"),
      "utf8",
    );
    const panel = readFileSync(
      resolve(root, "src/components/map/ActiveClaimPanel.tsx"),
      "utf8",
    );
    const nav = readFileSync(
      resolve(root, "src/components/map/ClaimNavigationActions.tsx"),
      "utf8",
    );
    expect(experience).toContain("void startSharing()");
    expect(panel).toContain("manageNativeTracker: !liveShareOverride");
    expect(nav).not.toContain("startSharing");
    expect(nav).not.toContain("startHandoffTracking");
  });
});
