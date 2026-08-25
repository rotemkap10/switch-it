"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  ACCOUNT_ALREADY_EXISTS_MESSAGE,
  EMAIL_VERIFICATION_FAILED_MESSAGE,
  EMAIL_VERIFICATION_REQUIRED_MESSAGE,
  authCallbackEmailRedirectTo,
  isEmailNotConfirmedError,
  isExplicitAccountExistsError,
  mapResendVerificationError,
} from "@/lib/auth/email-verification";
import {
  isWeakPasswordError,
  mapWeakPasswordError,
} from "@/lib/auth/password-policy";
import { resolvePostAuthRedirect } from "@/lib/auth/post-auth-redirect";
import { getAuthenticatedVehicleStatus } from "@/lib/auth/vehicle-status";
import { flattenFieldErrors } from "@/lib/feedback/flatten-field-errors";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, registerSchema } from "@/lib/validations/auth";

export type AuthActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  /** Signup succeeded or obfuscated; confirmation / check-email UI. */
  checkEmail?: boolean;
  /**
   * Supabase returned an explicit “already registered” Auth error.
   * Never set from heuristics such as empty `identities`.
   */
  accountExists?: boolean;
  /** Login blocked until the address is confirmed. */
  needsEmailVerification?: boolean;
  /** Address to show / use for resend (never treat as proof of existence alone). */
  email?: string;
  /** Resend Auth call returned without error — delivery is not guaranteed. */
  resendSuccess?: boolean;
  resendError?: string;
};

async function readRequestOrigin(): Promise<string | null> {
  const headerStore = await headers();
  return headerStore.get("origin");
}

export async function register(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = registerSchema.safeParse({
    display_name: formData.get("display_name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { fieldErrors: flattenFieldErrors(parsed.error) };
  }

  const { display_name, email, password } = parsed.data;
  const origin = await readRequestOrigin();

  if (!origin) {
    return { error: "Unable to create account. Try again." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name },
      emailRedirectTo: authCallbackEmailRedirectTo(origin),
    },
  });

  if (error) {
    if (isWeakPasswordError(error)) {
      return {
        fieldErrors: {
          password: [mapWeakPasswordError(error)],
        },
      };
    }
    if (isExplicitAccountExistsError(error)) {
      return {
        accountExists: true,
        email,
        error: ACCOUNT_ALREADY_EXISTS_MESSAGE,
      };
    }
    return { error: "Unable to create account. Try again." };
  }

  // Confirm Email enabled: no session until the link is opened.
  // Existing confirmed emails may also return success with no session
  // (anti-enumeration obfuscation) — use the same neutral Check your email UX.
  if (!data.session) {
    return { checkEmail: true, email };
  }

  // Confirm Email disabled (misconfigured project): keep prior onboarding path
  // so local/dev without confirmations does not soft-lock new users.
  redirect("/onboarding/vehicle");
}

export async function login(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") || undefined,
  });

  if (!parsed.success) {
    return { fieldErrors: flattenFieldErrors(parsed.error) };
  }

  const { email, password, next } = parsed.data;
  const supabase = await createClient();
  const { data: signInData, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !signInData.user) {
    if (isEmailNotConfirmedError(error)) {
      return {
        needsEmailVerification: true,
        email,
        error: EMAIL_VERIFICATION_REQUIRED_MESSAGE,
      };
    }
    if (isWeakPasswordError(error)) {
      // Rare on login; never show raw AuthWeakPasswordError text.
      return { error: mapWeakPasswordError(error) };
    }
    return { error: "Invalid email or password." };
  }

  const status = await getAuthenticatedVehicleStatus(supabase, signInData.user.id);
  redirect(resolvePostAuthRedirect(status, next));
}

/**
 * Resend the signup confirmation email for an address that has not verified yet.
 * Does not create a new Auth user.
 */
export async function resendSignupVerification(
  prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const emailRaw = formData.get("email");
  const email =
    typeof emailRaw === "string" ? emailRaw.trim().toLowerCase() : "";

  const base: AuthActionState = {
    email: email || (typeof emailRaw === "string" ? emailRaw : undefined),
    checkEmail: prevState.checkEmail,
    needsEmailVerification: prevState.needsEmailVerification,
    error: prevState.needsEmailVerification
      ? EMAIL_VERIFICATION_REQUIRED_MESSAGE
      : prevState.error,
  };

  if (!email || !email.includes("@")) {
    return {
      ...base,
      resendError: "Enter a valid email to resend the verification link.",
    };
  }

  const origin = await readRequestOrigin();
  if (!origin) {
    return {
      ...base,
      email,
      resendError: EMAIL_VERIFICATION_FAILED_MESSAGE,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: authCallbackEmailRedirectTo(origin),
    },
  });

  if (error) {
    return {
      ...base,
      email,
      resendError: mapResendVerificationError(error),
    };
  }

  return {
    ...base,
    email,
    checkEmail: prevState.checkEmail || !prevState.needsEmailVerification,
    resendSuccess: true,
    resendError: undefined,
  };
}

export async function logout() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await supabase.auth.signOut();
  redirect("/");
}
