import { z } from "zod";

export const claimSpotSchema = z.object({
  spot_id: z.uuid("Choose a valid parking spot."),
});

export type ClaimSpotInput = z.infer<typeof claimSpotSchema>;
