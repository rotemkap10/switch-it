import { z } from "zod";

export const plateSuffixSchema = z
  .string()
  .trim()
  .regex(/^\d{2}$/, "Enter the 2 hidden digits.");

export type PlateSuffixInput = z.infer<typeof plateSuffixSchema>;
