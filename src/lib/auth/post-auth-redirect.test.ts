import { describe, expect, it } from "vitest";

import { PASSWORD_RESET_PATH } from "@/lib/auth/password-recovery";
import { resolvePostAuthRedirect } from "@/lib/auth/post-auth-redirect";

const incomplete = {
  vehicleComplete: false,
  hasActiveSeekerClaim: false,
  hasActivePublisherSpot: false,
};

const complete = {
  vehicleComplete: true,
  hasActiveSeekerClaim: false,
  hasActivePublisherSpot: false,
};

describe("resolvePostAuthRedirect — password recovery", () => {
  it("sends recovery sessions to set-new-password before onboarding", () => {
    expect(resolvePostAuthRedirect(incomplete, PASSWORD_RESET_PATH)).toBe(
      PASSWORD_RESET_PATH,
    );
    expect(resolvePostAuthRedirect(complete, PASSWORD_RESET_PATH)).toBe(
      PASSWORD_RESET_PATH,
    );
  });

  it("keeps normal post-auth redirects unchanged", () => {
    expect(resolvePostAuthRedirect(incomplete, "/map")).toBe(
      "/onboarding/vehicle",
    );
    expect(resolvePostAuthRedirect(complete, "/map")).toBe("/map");
  });
});
