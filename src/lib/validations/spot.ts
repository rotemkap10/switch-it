import { z } from "zod";

import { sanitizeLocationLabel } from "@/lib/geocoding/sanitize-location-label";
import {
  LEAVE_DELAY_MAX_MINUTES,
  LEAVE_DELAY_MIN_MINUTES,
} from "@/lib/spots/constants";

/**
 * Client submits delay only. Absolute timestamps are computed in the
 * publishSpot server action via computeSpotAvailabilityWindow().
 */
export const publishSpotSchema = z.object({
  latitude: z.coerce
    .number({ error: "Latitude is required." })
    .min(-90, "Latitude must be between -90 and 90.")
    .max(90, "Latitude must be between -90 and 90."),
  longitude: z.coerce
    .number({ error: "Longitude is required." })
    .min(-180, "Longitude must be between -180 and 180.")
    .max(180, "Longitude must be between -180 and 180."),
  address: z
    .string()
    .max(200, "Address must be at most 200 characters.")
    .optional()
    .transform((value) => sanitizeLocationLabel(value ?? null)),
  available_in_minutes: z.coerce
    .number({ error: "Choose when you expect to leave." })
    .int("Choose when you expect to leave.")
    .min(LEAVE_DELAY_MIN_MINUTES, "Choose when you expect to leave.")
    .max(LEAVE_DELAY_MAX_MINUTES, "Choose when you expect to leave."),
});

export type PublishSpotInput = z.infer<typeof publishSpotSchema>;
