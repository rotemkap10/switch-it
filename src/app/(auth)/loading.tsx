import { BrandedLoadingState } from "@/components/brand/BrandedLoadingState";

/** Auth route loading — branded driving-car on the app background (no dark overlay). */
export default function AuthLoading() {
  return (
    <div
      className="flex min-h-dvh w-full flex-col"
      data-testid="auth-loading-shell"
    >
      <BrandedLoadingState
        label="Loading…"
        variant="page"
        ariaLabel="Loading page"
        className="min-h-dvh"
      />
    </div>
  );
}
