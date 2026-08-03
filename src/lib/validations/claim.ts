import { z } from "zod";

export const claimSpotSchema = z.object({
  spot_id: z.uuid("Choose a valid parking spot."),
});

export const completeClaimSchema = z.object({
  claim_id: z.uuid("Choose a valid claim."),
});

export type ClaimSpotInput = z.infer<typeof claimSpotSchema>;
export type CompleteClaimInput = z.infer<typeof completeClaimSchema>;
