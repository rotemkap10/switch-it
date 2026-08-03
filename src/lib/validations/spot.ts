import { z } from "zod";

import {
  AVAILABLE_IN_MINUTES_OPTIONS,
  SPOT_GRACE_MINUTES,
} from "@/lib/spots/constants";

const availableInMinutesSchema = z.coerce
  .number()
  .refine(
    (value): value is (typeof AVAILABLE_IN_MINUTES_OPTIONS)[number] =>
      (AVAILABLE_IN_MINUTES_OPTIONS as readonly number[]).includes(value),
    "Choose when you expect to leave.",
  );

export const publishSpotSchema = z
  .object({
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
      .trim()
      .max(200, "Address must be at most 200 characters.")
      .optional()
      .transform((value) => (value && value.length > 0 ? value : null)),
    available_in_minutes: availableInMinutesSchema,
  })
  .transform((data) => {
    const now = Date.now();
    const availableAt = new Date(now + data.available_in_minutes * 60_000);
    const expiresAt = new Date(
      availableAt.getTime() + SPOT_GRACE_MINUTES * 60_000,
    );

    return {
      latitude: data.latitude,
      longitude: data.longitude,
      address: data.address,
      available_at: availableAt.toISOString(),
      expires_at: expiresAt.toISOString(),
    };
  });

export type PublishSpotInput = z.infer<typeof publishSpotSchema>;
