import { describe, expect, it } from "vitest";

import {
  decideNativeStart,
  decideNativeTrackingReconcile,
} from "@/lib/location/handoff-native-reconcile";

const claimA = "11111111-1111-4111-8111-111111111111";
const claimB = "22222222-2222-4222-8222-222222222222";

describe("native handoff start / reconcile", () => {
  it("A. starts one tracker for a fresh active claim", () => {
    expect(
      decideNativeStart({
        claimId: claimA,
        expiresAtEpochMs: Date.now() + 60_000,
        currentActive: false,
        currentClaimId: null,
      }),
    ).toEqual({ kind: "start" });
  });

  it("G. does not start a second tracker for the same claim", () => {
    expect(
      decideNativeStart({
        claimId: claimA,
        expiresAtEpochMs: Date.now() + 60_000,
        currentActive: true,
        currentClaimId: claimA,
      }),
    ).toEqual({ kind: "already_running" });
  });

  it("replaces tracking when the active claim changes", () => {
    expect(
      decideNativeStart({
        claimId: claimB,
        expiresAtEpochMs: Date.now() + 60_000,
        currentActive: true,
        currentClaimId: claimA,
      }),
    ).toEqual({ kind: "replace" });
  });

  it("E. stops when the claim is expired even if the app is backgrounded", () => {
    expect(
      decideNativeTrackingReconcile({
        enabled: true,
        currentClaimId: claimA,
        expiresAtIso: new Date(Date.now() - 1_000).toISOString(),
        nativeActive: true,
        nativeClaimId: claimA,
      }),
    ).toEqual({ action: "stop", reason: "expired" });
  });

  it("D. stops when the active claim ends", () => {
    expect(
      decideNativeTrackingReconcile({
        enabled: false,
        currentClaimId: claimA,
        expiresAtIso: new Date(Date.now() + 60_000).toISOString(),
        nativeActive: true,
        nativeClaimId: claimA,
      }),
    ).toEqual({ action: "stop", reason: "disabled" });
  });

  it("keeps the existing tracker after remount of the same claim", () => {
    expect(
      decideNativeTrackingReconcile({
        enabled: true,
        currentClaimId: claimA,
        expiresAtIso: new Date(Date.now() + 60_000).toISOString(),
        nativeActive: true,
        nativeClaimId: claimA,
      }),
    ).toEqual({ action: "keep", claimId: claimA });
  });
});
