/**
 * App-side password policy for Create Account (and any future new-password forms).
 * Aligned with Supabase Auth `lower_upper_letters_digits_symbols` + min length 8.
 * Supabase Auth remains the authoritative enforcer.
 */

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

export const PASSWORD_POLICY_SUMMARY =
  "Password must contain at least 8 characters, including uppercase, lowercase, a number, and a special character.";

export const WEAK_PASSWORD_GENERIC_MESSAGE =
  "Your password does not meet the security requirements.";

export type PasswordRequirementId =
  | "length"
  | "lowercase"
  | "uppercase"
  | "digit"
  | "special";

export type PasswordRequirementStatus = {
  id: PasswordRequirementId;
  label: string;
  met: boolean;
};

/** Special = any non-alphanumeric character (matches Supabase symbols broadly). */
export function hasSpecialCharacter(password: string): boolean {
  return /[^A-Za-z0-9]/.test(password);
}

export function evaluatePasswordRequirements(
  password: string,
): PasswordRequirementStatus[] {
  return [
    {
      id: "length",
      label: "8+ characters",
      met: password.length >= PASSWORD_MIN_LENGTH,
    },
    {
      id: "lowercase",
      label: "Lowercase letter",
      met: /[a-z]/.test(password),
    },
    {
      id: "uppercase",
      label: "Uppercase letter",
      met: /[A-Z]/.test(password),
    },
    {
      id: "digit",
      label: "Number",
      met: /\d/.test(password),
    },
    {
      id: "special",
      label: "Special character",
      met: hasSpecialCharacter(password),
    },
  ];
}

export function isPasswordPolicySatisfied(password: string): boolean {
  if (password.length > PASSWORD_MAX_LENGTH) {
    return false;
  }
  return evaluatePasswordRequirements(password).every((item) => item.met);
}

/**
 * Human-readable field error for local validation.
 * Prefer specific missing pieces when only a few rules fail.
 */
export function describePasswordPolicyFailure(password: string): string | null {
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`;
  }

  const unmet = evaluatePasswordRequirements(password).filter(
    (item) => !item.met,
  );
  if (unmet.length === 0) {
    return null;
  }

  if (unmet.length >= 4) {
    return PASSWORD_POLICY_SUMMARY;
  }

  const labels = unmet.map((item) => item.label.toLowerCase());
  if (labels.length === 1) {
    return `Password needs: ${labels[0]}.`;
  }
  const head = labels.slice(0, -1).join(", ");
  const tail = labels[labels.length - 1];
  return `Password needs: ${head}, and ${tail}.`;
}

type AuthErrorLike = {
  name?: string | null;
  code?: string | null;
  message?: string | null;
  reasons?: string[] | null;
};

function messageOf(error: AuthErrorLike | null | undefined): string {
  return (error?.message ?? "").toLowerCase();
}

function codeOf(error: AuthErrorLike | null | undefined): string {
  return (error?.code ?? "").toLowerCase();
}

/** Detect Supabase AuthWeakPasswordError / weak_password API failures. */
export function isWeakPasswordError(
  error: AuthErrorLike | null | undefined,
): boolean {
  if (!error) {
    return false;
  }
  if (error.name === "AuthWeakPasswordError") {
    return true;
  }
  if (codeOf(error) === "weak_password") {
    return true;
  }
  const message = messageOf(error);
  return (
    message.includes("weak password") ||
    message.includes("password is too weak") ||
    message.includes("password should contain") ||
    message.includes("password should be at least")
  );
}

/**
 * Map Supabase weak-password reasons to Switch It copy.
 * Known reasons: length | characters | pwned
 */
export function mapWeakPasswordError(
  error: AuthErrorLike | null | undefined,
): string {
  const reasons = Array.isArray(error?.reasons)
    ? error.reasons.map((r) => String(r).toLowerCase())
    : [];

  if (reasons.includes("pwned")) {
    return "That password appears in known data breaches. Choose a different password.";
  }

  const parts: string[] = [];
  if (reasons.includes("length")) {
    parts.push("at least 8 characters");
  }
  if (reasons.includes("characters")) {
    parts.push("uppercase, lowercase, a number, and a special character");
  }

  if (parts.length === 1) {
    return `Your password does not meet the security requirements. It needs ${parts[0]}.`;
  }
  if (parts.length > 1) {
    return `Your password does not meet the security requirements. It needs ${parts.join(", and ")}.`;
  }

  return WEAK_PASSWORD_GENERIC_MESSAGE;
}
