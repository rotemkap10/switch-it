import type { ZodError } from "zod";

export function flattenFieldErrors(
  error: ZodError,
  fallbackKey = "form",
): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key =
      typeof issue.path[0] === "string" ? issue.path[0] : fallbackKey;
    fieldErrors[key] ??= [];
    fieldErrors[key].push(issue.message);
  }
  return fieldErrors;
}
