import { AuthBrand } from "@/components/brand/AuthBrand";
import { BrandedLoadingState } from "@/components/brand/BrandedLoadingState";

type AuthRouteLoadingChromeProps = {
  testId?: string;
};

/**
 * Auth + onboarding loading shell — matches final `auth-page` geometry
 * (brand lockup + form column), not the authenticated app shell.
 */
export function AuthRouteLoadingChrome({
  testId = "auth-loading-shell",
}: AuthRouteLoadingChromeProps) {
  return (
    <main className="auth-page" data-testid={testId} data-layout="auth">
      <AuthBrand />
      <BrandedLoadingState
        label="Loading…"
        variant="page"
        ariaLabel="Loading page"
        className="min-h-[12rem] flex-1"
      />
    </main>
  );
}
