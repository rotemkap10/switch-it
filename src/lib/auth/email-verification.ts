/**
 * Helpers for Supabase Auth email confirmation (signup verify / resend).
 * Supabase Auth remains the source of truth — no app-level verified flag.
 */

export const EMAIL_VERIFICATION_REQUIRED_MESSAGE =
  "Please verify your email before signing in.";

export const EMAIL_VERIFICATION_SENT_MESSAGE =
  "Verification email sent again.";

export const EMAIL_VERIFICATION_RATE_LIMIT_MESSAGE =
  "Please wait a moment before requesting another email.";

export const EMAIL_VERIFICATION_FAILED_MESSAGE =
  "Unable to send verification email. Try again.";

export const EMAIL_VERIFICATION_LINK_INVALID_MESSAGE =
  "That verification link is invalid or has expired. Sign in to request a new one, or create an account again.";

type AuthErrorLike = {
  code?: string | null;
  message?: string | null;
  status?: number | null;
};

function messageOf(error: AuthErrorLike | null | undefined): string {
  return (error?.message ?? "").toLowerCase();
}

function codeOf(error: AuthErrorLike | null | undefined): string {
  return (error?.code ?? "").toLowerCase();
}

/** True when sign-in failed because the address is not confirmed yet. */
export function isEmailNotConfirmedError(
  error: AuthErrorLike | null | undefined,
): boolean {
  if (!error) {
    return false;
  }
  const code = codeOf(error);
  if (
    code === "email_not_confirmed" ||
    code === "email_not_confirmed_exception"
  ) {
    return true;
  }
  const message = messageOf(error);
  return (
    message.includes("email not confirmed") ||
    message.includes("email_not_confirmed") ||
    message.includes("confirm your email")
  );
}

/** True when Auth rate-limited a confirmation / resend request. */
export function isAuthRateLimitError(
  error: AuthErrorLike | null | undefined,
): boolean {
  if (!error) {
    return false;
  }
  const code = codeOf(error);
  if (
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit" ||
    code === "too_many_requests"
  ) {
    return true;
  }
  if (error.status === 429) {
    return true;
  }
  const message = messageOf(error);
  return (
    message.includes("rate limit") ||
    message.includes("security purposes") ||
    message.includes("only request this after") ||
    message.includes("too many requests") ||
    message.includes("for security purposes")
  );
}

export function authCallbackEmailRedirectTo(origin: string): string {
  return `${origin.replace(/\/$/, "")}/auth/callback`;
}

export function mapResendVerificationError(
  error: AuthErrorLike | null | undefined,
): string {
  if (isAuthRateLimitError(error)) {
    return EMAIL_VERIFICATION_RATE_LIMIT_MESSAGE;
  }
  return EMAIL_VERIFICATION_FAILED_MESSAGE;
}
