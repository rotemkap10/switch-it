import { z } from "zod";

import { APP_ERROR_MESSAGES } from "@/lib/feedback/error-map";
import { plateSuffixSchema } from "@/lib/validations/plate-suffix";

const LOCATION_REQUIRED_MESSAGE = APP_ERROR_MESSAGES.LOCATION_REQUIRED;

function seekerCoordinateField() {
  return z.preprocess(
    (value) => {
      if (value == null || value === "") {
        return undefined;
      }
      return value;
    },
    z.coerce
      .number({ error: LOCATION_REQUIRED_MESSAGE })
      .finite(LOCATION_REQUIRED_MESSAGE)
      .min(-90, LOCATION_REQUIRED_MESSAGE)
      .max(90, LOCATION_REQUIRED_MESSAGE),
  );
}

function seekerLongitudeField() {
  return z.preprocess(
    (value) => {
      if (value == null || value === "") {
        return undefined;
      }
      return value;
    },
    z.coerce
      .number({ error: LOCATION_REQUIRED_MESSAGE })
      .finite(LOCATION_REQUIRED_MESSAGE)
      .min(-180, LOCATION_REQUIRED_MESSAGE)
      .max(180, LOCATION_REQUIRED_MESSAGE),
  );
}

export const claimSpotSchema = z.object({
  spot_id: z.uuid("Choose a valid parking spot."),
  seeker_latitude: seekerCoordinateField(),
  seeker_longitude: seekerLongitudeField(),
});

export const completeClaimSchema = z.object({
  claim_id: z.uuid("Choose a valid claim."),
  plate_suffix: plateSuffixSchema,
});

export const cancelClaimSchema = z.object({
  claim_id: z.uuid("Choose a valid claim."),
});

export const extendHandoffWaitSchema = z.object({
  claim_id: z.uuid("Choose a valid claim."),
});

export const startHandoffNowSchema = z.object({
  spot_id: z.uuid("Choose a valid parking spot."),
});

export const cancelSpotSchema = z.object({
  spot_id: z.uuid("Choose a valid parking spot."),
});

export type ClaimSpotInput = z.infer<typeof claimSpotSchema>;
export type CompleteClaimInput = z.infer<typeof completeClaimSchema>;
export type CancelClaimInput = z.infer<typeof cancelClaimSchema>;
export type ExtendHandoffWaitInput = z.infer<typeof extendHandoffWaitSchema>;
export type CancelSpotInput = z.infer<typeof cancelSpotSchema>;
export type StartHandoffNowInput = z.infer<typeof startHandoffNowSchema>;
