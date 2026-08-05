"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { resolvePostAuthRedirect } from "@/lib/auth/post-auth-redirect";
import { getAuthenticatedVehicleStatus } from "@/lib/auth/vehicle-status";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, registerSchema } from "@/lib/validations/auth";

export type AuthActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  checkEmail?: boolean;
};

function flattenFieldErrors(
  error: import("zod").ZodError,
): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key !== "string") continue;
    fieldErrors[key] ??= [];
    fieldErrors[key].push(issue.message);
  }
  return fieldErrors;
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
  const headerStore = await headers();
  const origin = headerStore.get("origin");

  if (!origin) {
    return { error: "Unable to create account. Try again." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    return { error: "Unable to create account. Try again." };
  }

  if (!data.session) {
    return { checkEmail: true };
  }

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
    return { error: "Invalid email or password." };
  }

  const status = await getAuthenticatedVehicleStatus(supabase, signInData.user.id);
  redirect(resolvePostAuthRedirect(status, next));
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
