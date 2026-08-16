import { AuthRouteLoadingChrome } from "@/components/shell/AuthRouteLoadingChrome";

/** Match login/register `auth-page` geometry immediately. */
export default function AuthLoading() {
  return <AuthRouteLoadingChrome testId="auth-loading-shell" />;
}
