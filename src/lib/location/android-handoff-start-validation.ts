/**
 * Mirrors Android `HandoffStartValidation` for Vitest contract coverage.
 * Keep in sync with:
 * native/handoff-background-location/android/.../HandoffStartValidation.java
 *
 * Capacitor Android stores epoch-ms integers as Long; PluginCall.getDouble()
 * does not accept Long and returns null — that must not collapse to a vague
 * invalid_claim. Prefer Number/Long-aware epoch reading on Android.
 */

export type AndroidStartValidationReason =
  | "invalid_claim_id"
  | "invalid_expiry"
  | "expired"
  | "missing_access_token"
  | "invalid_supabase_url"
  | "missing_publishable_key"
  | "invalid_edge_function_url";

export type AndroidStartValidationResult = {
  ok: boolean;
  reason: AndroidStartValidationReason | null;
  claimIdValid: boolean;
  expiresPresent: boolean;
  expiresDeltaMs: number | null;
  accessTokenPresent: boolean;
  supabaseUrlValid: boolean;
  publishableKeyPresent: boolean;
  edgeFunctionUrlValid: boolean;
};

/** Simulates Capacitor Android PluginCall.getDouble (no Long support). */
export function capacitorGetDouble(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    // Bridge often boxes integers > MAX_SAFE as Long; treat tagged Long separately.
    return value;
  }
  return null;
}

/**
 * Capacitor stores JS numbers that fit in int32 as Integer and larger as Long.
 * Epoch ms always exceeds Integer.MAX_VALUE, so the bridge uses Long.
 */
export function capacitorBridgeNumber(epochMs: number): {
  kind: "Long" | "Integer" | "Double";
  value: number;
} {
  if (!Number.isInteger(epochMs)) {
    return { kind: "Double", value: epochMs };
  }
  if (epochMs > 2147483647 || epochMs < -2147483648) {
    return { kind: "Long", value: epochMs };
  }
  return { kind: "Integer", value: epochMs };
}

/** Capacitor getDouble does not handle Long — returns null for epoch ms. */
export function capacitorGetDoubleFromBridgedEpoch(epochMs: number): number | null {
  const bridged = capacitorBridgeNumber(epochMs);
  if (bridged.kind === "Long") {
    return null;
  }
  if (bridged.kind === "Integer" || bridged.kind === "Double") {
    return bridged.value;
  }
  return null;
}

export function readEpochMs(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const asInt = Number.parseInt(trimmed, 10);
    if (Number.isFinite(asInt)) {
      return asInt;
    }
    const asFloat = Number.parseFloat(trimmed);
    if (Number.isFinite(asFloat)) {
      return Math.trunc(asFloat);
    }
  }
  return null;
}

function isNonBlank(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function isUuidShaped(claimId: string | null | undefined): boolean {
  if (!isNonBlank(claimId)) {
    return false;
  }
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    claimId!.trim(),
  );
}

export function isHttpsUrl(url: string | null | undefined): boolean {
  if (!isNonBlank(url)) {
    return false;
  }
  const trimmed = url!.trim().toLowerCase();
  return trimmed.startsWith("https://") && trimmed.length > "https://".length;
}

export function isAcceptablePublishableKey(
  key: string | null | undefined,
): boolean {
  if (!isNonBlank(key)) {
    return false;
  }
  const trimmed = key!.trim();
  if (trimmed.startsWith("sb_publishable_")) {
    return trimmed.length > "sb_publishable_".length;
  }
  return trimmed.startsWith("eyJ") && trimmed.length > 20;
}

export function validateAndroidHandoffStart(input: {
  claimId: string | null | undefined;
  expiresAtEpochMs: unknown;
  accessToken: string | null | undefined;
  supabaseUrl: string | null | undefined;
  publishableKey: string | null | undefined;
  edgeFunctionUrl: string | null | undefined;
  nowMs?: number;
}): AndroidStartValidationResult {
  const nowMs = input.nowMs ?? Date.now();
  const claimIdValid = isUuidShaped(input.claimId);
  const expiresAtEpochMs = readEpochMs(input.expiresAtEpochMs);
  const expiresPresent = expiresAtEpochMs !== null;
  const expiresDeltaMs =
    expiresPresent && expiresAtEpochMs !== null
      ? expiresAtEpochMs - nowMs
      : null;
  const accessTokenPresent = isNonBlank(input.accessToken);
  const supabaseUrlValid = isHttpsUrl(input.supabaseUrl);
  const publishableKeyPresent = isAcceptablePublishableKey(input.publishableKey);
  const edgeFunctionUrlValid = isHttpsUrl(input.edgeFunctionUrl);

  const flags = {
    claimIdValid,
    expiresPresent,
    expiresDeltaMs,
    accessTokenPresent,
    supabaseUrlValid,
    publishableKeyPresent,
    edgeFunctionUrlValid,
  };

  if (!claimIdValid) {
    return { ok: false, reason: "invalid_claim_id", ...flags };
  }
  if (!expiresPresent || expiresAtEpochMs === null) {
    return { ok: false, reason: "invalid_expiry", ...flags };
  }
  if (expiresAtEpochMs <= nowMs) {
    return { ok: false, reason: "expired", ...flags };
  }
  if (!accessTokenPresent) {
    return { ok: false, reason: "missing_access_token", ...flags };
  }
  if (!supabaseUrlValid) {
    return { ok: false, reason: "invalid_supabase_url", ...flags };
  }
  if (!publishableKeyPresent) {
    return { ok: false, reason: "missing_publishable_key", ...flags };
  }
  if (!edgeFunctionUrlValid) {
    return { ok: false, reason: "invalid_edge_function_url", ...flags };
  }
  return { ok: true, reason: null, ...flags };
}
