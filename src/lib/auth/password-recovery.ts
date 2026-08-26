/**
 * Forgot-password / recovery helpers.
 * Uses Supabase Auth resetPasswordForEmail + updateUser — no custom tokens.
 */

export const FORGOT_PASSWORD_PATH = "/forgot-password";
export const PASSWORD_RESET_PATH = "/auth/reset-password";
/** PKCE recovery callback — no query params required on the emailed link. */
export const PASSWORD_RECOVERY_CALLBACK_PATH = "/auth/callback/recovery";

export const PASSWORD_RESET_CHECK_EMAIL_MESSAGE =
  "If an account exists for this email, you'll receive a password reset link.";

export const PASSWORD_RESET_RATE_LIMIT_MESSAGE =
  "Too many attempts. Please wait a moment and try again.";

export const PASSWORD_RESET_GENERIC_FAILURE_MESSAGE =
  "We couldn't reset your password right now. Please try again.";

export const PASSWORD_RESET_LINK_INVALID_MESSAGE =
  "This password reset link is invalid or has expired.";

export const PASSWORD_MISMATCH_MESSAGE = "Passwords do not match.";

export const PASSWORD_UPDATED_MESSAGE =
  "Your password has been changed successfully.";

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

/** True when Auth rate-limited a password reset / update request. */
export function isPasswordResetRateLimitError(
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

export function mapPasswordResetRequestError(
  error: AuthErrorLike | null | undefined,
): string {
  if (isPasswordResetRateLimitError(error)) {
    return PASSWORD_RESET_RATE_LIMIT_MESSAGE;
  }
  return PASSWORD_RESET_GENERIC_FAILURE_MESSAGE;
}

export function mapPasswordUpdateError(
  error: AuthErrorLike | null | undefined,
): string {
  if (isPasswordResetRateLimitError(error)) {
    return PASSWORD_RESET_RATE_LIMIT_MESSAGE;
  }
  const message = messageOf(error);
  if (
    message.includes("session") ||
    message.includes("not authenticated") ||
    message.includes("jwt") ||
    codeOf(error) === "session_not_found"
  ) {
    return PASSWORD_RESET_LINK_INVALID_MESSAGE;
  }
  return PASSWORD_RESET_GENERIC_FAILURE_MESSAGE;
}

export function isPasswordRecoveryPath(
  next: string | null | undefined,
): boolean {
  if (!next) {
    return false;
  }
  const path = next.split("?")[0]?.split("#")[0] ?? "";
  return path === PASSWORD_RESET_PATH;
}

/** True when a callback request is part of the forgot-password flow. */
export function isPasswordRecoveryCallback(params: {
  next?: string | null;
  type?: string | null;
  forceRecovery?: boolean;
}): boolean {
  if (params.forceRecovery) {
    return true;
  }
  if (params.type === "recovery") {
    return true;
  }
  return isPasswordRecoveryPath(params.next);
}

/**
 * PKCE recovery callback path. Supabase PKCE redirects append `?code=` but often
 * drop extra query params from `redirectTo`, so we use a dedicated route.
 */
export function authPasswordRecoveryRedirectTo(origin: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}${PASSWORD_RECOVERY_CALLBACK_PATH}`;
}
