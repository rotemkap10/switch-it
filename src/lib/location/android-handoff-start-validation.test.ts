import { describe, expect, it } from "vitest";

import {
  capacitorBridgeNumber,
  capacitorGetDoubleFromBridgedEpoch,
  isAcceptablePublishableKey,
  isHttpsUrl,
  isUuidShaped,
  readEpochMs,
  validateAndroidHandoffStart,
} from "@/lib/location/android-handoff-start-validation";

const claimId = "0b590c28-e9f5-48c0-ad6d-70850b0e3f5a";
const nowMs = 1_700_000_000_000;
const futureExpires = nowMs + 600_000;

describe("android handoff start validation contract", () => {
  it("documents Capacitor getDouble rejecting Long-bridged epoch ms", () => {
    const bridged = capacitorBridgeNumber(1_787_318_032_480);
    expect(bridged.kind).toBe("Long");
    // Pre-fix bug: PluginCall.getDouble(Long) → null → invalid_claim
    expect(capacitorGetDoubleFromBridgedEpoch(1_787_318_032_480)).toBeNull();
    // Fix: Long-aware reader keeps milliseconds as milliseconds
    expect(readEpochMs(1_787_318_032_480)).toBe(1_787_318_032_480);
  });

  it("accepts a valid UUID claim id", () => {
    expect(isUuidShaped(claimId)).toBe(true);
    expect(isUuidShaped(claimId.toUpperCase())).toBe(true);
  });

  it("rejects a malformed claim id", () => {
    expect(isUuidShaped("not-a-uuid")).toBe(false);
    expect(isUuidShaped("")).toBe(false);
    expect(isUuidShaped(null)).toBe(false);
  });

  it("accepts future expiresAtEpochMs in milliseconds", () => {
    const result = validateAndroidHandoffStart({
      claimId,
      expiresAtEpochMs: futureExpires,
      accessToken: "session-token",
      supabaseUrl: "https://example.supabase.co",
      publishableKey: "sb_publishable_test_key_abc",
      edgeFunctionUrl:
        "https://example.supabase.co/functions/v1/handoff-seeker-location",
      nowMs,
    });
    expect(result.ok).toBe(true);
    expect(result.expiresPresent).toBe(true);
    expect(result.expiresDeltaMs).toBe(600_000);
  });

  it("rejects expired timestamps without treating them as invalid_claim", () => {
    const result = validateAndroidHandoffStart({
      claimId,
      expiresAtEpochMs: nowMs - 1,
      accessToken: "session-token",
      supabaseUrl: "https://example.supabase.co",
      publishableKey: "sb_publishable_test_key_abc",
      edgeFunctionUrl:
        "https://example.supabase.co/functions/v1/handoff-seeker-location",
      nowMs,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("expired");
  });

  it("rejects missing expiry as invalid_expiry (the former Long/getDouble failure)", () => {
    const result = validateAndroidHandoffStart({
      claimId,
      expiresAtEpochMs: null,
      accessToken: "session-token",
      supabaseUrl: "https://example.supabase.co",
      publishableKey: "sb_publishable_test_key_abc",
      edgeFunctionUrl:
        "https://example.supabase.co/functions/v1/handoff-seeker-location",
      nowMs,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("invalid_expiry");
    expect(result.expiresPresent).toBe(false);
    expect(result.claimIdValid).toBe(true);
  });

  it("keeps milliseconds as milliseconds (does not treat ms as unix seconds)", () => {
    // If someone divided by 1000 by mistake, 1787318032 would look "expired"
    // relative to nowMs in ms. Future ms values must stay >> 1e12.
    const expiresMs = 1_787_318_032_480;
    expect(expiresMs).toBeGreaterThan(1_000_000_000_000);
    expect(readEpochMs(expiresMs)).toBe(expiresMs);
    const result = validateAndroidHandoffStart({
      claimId,
      expiresAtEpochMs: expiresMs,
      accessToken: "session-token",
      supabaseUrl: "https://example.supabase.co",
      publishableKey: "sb_publishable_test_key_abc",
      edgeFunctionUrl:
        "https://example.supabase.co/functions/v1/handoff-seeker-location",
      nowMs: 1_787_000_000_000,
    });
    expect(result.ok).toBe(true);
    expect(result.expiresDeltaMs).toBe(expiresMs - 1_787_000_000_000);
  });

  it("accepts modern sb_publishable_ keys", () => {
    expect(isAcceptablePublishableKey("sb_publishable_abc123")).toBe(true);
  });

  it("accepts legacy eyJ JWT-shaped anon keys", () => {
    expect(
      isAcceptablePublishableKey(
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.legacy.test.signature",
      ),
    ).toBe(true);
  });

  it("rejects missing access token", () => {
    const result = validateAndroidHandoffStart({
      claimId,
      expiresAtEpochMs: futureExpires,
      accessToken: "   ",
      supabaseUrl: "https://example.supabase.co",
      publishableKey: "sb_publishable_test_key_abc",
      edgeFunctionUrl:
        "https://example.supabase.co/functions/v1/handoff-seeker-location",
      nowMs,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("missing_access_token");
  });

  it("accepts valid HTTPS Supabase and edge function URLs", () => {
    expect(isHttpsUrl("https://example.supabase.co")).toBe(true);
    expect(
      isHttpsUrl(
        "https://example.supabase.co/functions/v1/handoff-seeker-location",
      ),
    ).toBe(true);
    expect(isHttpsUrl("http://insecure.example")).toBe(false);
  });

  it("rejects invalid edge function URL specifically", () => {
    const result = validateAndroidHandoffStart({
      claimId,
      expiresAtEpochMs: futureExpires,
      accessToken: "session-token",
      supabaseUrl: "https://example.supabase.co",
      publishableKey: "sb_publishable_test_key_abc",
      edgeFunctionUrl: "not-a-url",
      nowMs,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("invalid_edge_function_url");
  });
});
