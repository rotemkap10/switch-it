import { AuthRouteLoadingChrome } from "@/components/shell/AuthRouteLoadingChrome";

/** Onboarding uses auth-page geometry — not the authenticated app shell. */
export default function OnboardingLoading() {
  return <AuthRouteLoadingChrome testId="onboarding-loading-shell" />;
}
