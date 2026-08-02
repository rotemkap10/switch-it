import { z } from "zod";

import {
  SPOT_AVAILABLE_AT_MAX_AHEAD_MINUTES,
  SPOT_MAX_WINDOW_MINUTES,
  SPOT_MIN_WINDOW_MINUTES,
} from "@/lib/spots/constants";

function parseFormDateTime(value: unknown): Date | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

const minutesToMs = (minutes: number) => minutes * 60 * 1000;

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
    available_at: z.string().min(1, "Available time is required."),
    expires_at: z.string().min(1, "Expiry time is required."),
  })
  .superRefine((data, ctx) => {
    const availableAt = parseFormDateTime(data.available_at);
    const expiresAt = parseFormDateTime(data.expires_at);
    const now = Date.now();

    if (!availableAt) {
      ctx.addIssue({
        code: "custom",
        path: ["available_at"],
        message: "Enter a valid available time.",
      });
      return;
    }

    if (!expiresAt) {
      ctx.addIssue({
        code: "custom",
        path: ["expires_at"],
        message: "Enter a valid expiry time.",
      });
      return;
    }

    if (availableAt.getTime() < now) {
      ctx.addIssue({
        code: "custom",
        path: ["available_at"],
        message: "Available time cannot be in the past.",
      });
    }

    if (
      availableAt.getTime() >
      now + minutesToMs(SPOT_AVAILABLE_AT_MAX_AHEAD_MINUTES)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["available_at"],
        message: `Available time must be within ${SPOT_AVAILABLE_AT_MAX_AHEAD_MINUTES} minutes from now.`,
      });
    }

    const windowMs = expiresAt.getTime() - availableAt.getTime();

    if (windowMs < minutesToMs(SPOT_MIN_WINDOW_MINUTES)) {
      ctx.addIssue({
        code: "custom",
        path: ["expires_at"],
        message: `Expiry must be at least ${SPOT_MIN_WINDOW_MINUTES} minutes after available time.`,
      });
    }

    if (windowMs > minutesToMs(SPOT_MAX_WINDOW_MINUTES)) {
      ctx.addIssue({
        code: "custom",
        path: ["expires_at"],
        message: `Expiry must be no more than ${SPOT_MAX_WINDOW_MINUTES} minutes after available time.`,
      });
    }
  })
  .transform((data) => {
    const availableAt = parseFormDateTime(data.available_at)!;
    const expiresAt = parseFormDateTime(data.expires_at)!;

    return {
      latitude: data.latitude,
      longitude: data.longitude,
      address: data.address,
      available_at: availableAt.toISOString(),
      expires_at: expiresAt.toISOString(),
    };
  });

export type PublishSpotInput = z.infer<typeof publishSpotSchema>;
