import { z } from "zod";

export const handoffCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{5}$/, "Enter a 5-digit handoff code.");

export type HandoffCodeInput = z.infer<typeof handoffCodeSchema>;
