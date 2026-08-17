import {
  isHandoffPushType,
  type HandoffPushRecipientRole,
  type HandoffPushType,
} from "@/lib/push/types";

export type HandoffPushPayload = {
  type: HandoffPushType;
  claimId: string;
  spotId: string | null;
  recipientRole: HandoffPushRecipientRole;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const COORD_KEYS = [
  "latitude",
  "longitude",
  "lat",
  "lng",
  "accuracy",
  "accuracyMeters",
  "heading",
  "headingDegrees",
];

export function parseHandoffPushPayload(
  value: unknown,
): HandoffPushPayload | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const type = raw.type;
  const claimId = typeof raw.claimId === "string" ? raw.claimId : raw.claim_id;
  const spotId =
    typeof raw.spotId === "string"
      ? raw.spotId
      : typeof raw.spot_id === "string"
        ? raw.spot_id
        : null;
  const recipientRole =
    raw.recipientRole === "seeker" || raw.recipientRole === "publisher"
      ? raw.recipientRole
      : raw.recipient_role === "seeker" || raw.recipient_role === "publisher"
        ? raw.recipient_role
        : null;

  if (!isHandoffPushType(type)) {
    return null;
  }
  if (typeof claimId !== "string" || !UUID_RE.test(claimId)) {
    return null;
  }
  if (spotId != null && (typeof spotId !== "string" || !UUID_RE.test(spotId))) {
    return null;
  }
  if (!recipientRole) {
    return null;
  }

  return {
    type,
    claimId: claimId.toLowerCase(),
    spotId: spotId ? spotId.toLowerCase() : null,
    recipientRole,
  };
}

export function buildHandoffPushData(input: HandoffPushPayload): Record<string, string> {
  return {
    type: input.type,
    claimId: input.claimId,
    spotId: input.spotId ?? "",
    recipientRole: input.recipientRole,
  };
}

export function pushPayloadContainsCoordinates(
  value: Record<string, unknown>,
): boolean {
  return COORD_KEYS.some((key) => key in value);
}
