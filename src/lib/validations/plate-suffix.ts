import { z } from "zod";

export const plateSuffixSchema = z
  .string()
  .trim()
  .regex(/^\d{2}$/, "Enter the last 2 digits.");

export type PlateSuffixInput = z.infer<typeof plateSuffixSchema>;
