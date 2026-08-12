export type HandoffTrackingSource = "web" | "native";

export type HandoffTrackingStartInput = {
  claimId: string;
  expiresAtIso: string;
  accessToken: string;
  supabaseUrl: string;
  supabasePublishableKey: string;
};

export type HandoffTrackingStartResult =
  | { ok: true; source: HandoffTrackingSource }
  | {
      ok: false;
      reason:
        | "permission_denied"
        | "unavailable"
        | "expired"
        | "invalid_claim"
        | "no_session";
    };

export type HandoffTrackingState = {
  active: boolean;
  claimId: string | null;
  source: HandoffTrackingSource | null;
};

export type NativeHandoffPluginStartOptions = {
  claimId: string;
  expiresAtEpochMs: number;
  accessToken: string;
  supabaseUrl: string;
  publishableKey: string;
  edgeFunctionUrl: string;
};
