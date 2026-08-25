import { z } from "zod";

import { describePasswordPolicyFailure } from "@/lib/auth/password-policy";

export const registerSchema = z.object({
  display_name: z
    .string()
    .trim()
    .min(1, "Display name is required.")
    .max(50, "Display name must be at most 50 characters."),
  email: z.email("Enter a valid email address."),
  password: z.string().superRefine((value, ctx) => {
    const failure = describePasswordPolicyFailure(value);
    if (failure) {
      ctx.addIssue({
        code: "custom",
        message: failure,
      });
    }
  }),
});

/** Login only requires a non-empty password — do not apply signup policy. */
export const loginSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
  next: z.string().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
