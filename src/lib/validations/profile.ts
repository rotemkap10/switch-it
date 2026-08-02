import { z } from "zod";

export const updateDisplayNameSchema = z.object({
  display_name: z
    .string()
    .trim()
    .min(2, "Display name must be at least 2 characters.")
    .max(50, "Display name must be at most 50 characters."),
});

export type UpdateDisplayNameInput = z.infer<typeof updateDisplayNameSchema>;
