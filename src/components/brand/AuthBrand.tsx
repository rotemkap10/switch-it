import { Logo } from "@/components/branding/Logo";

type AuthBrandProps = {
  className?: string;
};

/**
 * Auth/onboarding brand lockup: official Switch It logo above the form.
 */
export function AuthBrand({ className = "" }: AuthBrandProps) {
  return (
    <div
      className={["auth-brand", className].filter(Boolean).join(" ")}
      data-testid="auth-brand"
    >
      <Logo variant="auth" />
    </div>
  );
}
