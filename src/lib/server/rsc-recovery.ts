import { unstable_rethrow } from "next/navigation";

import { logRecoverableFailure } from "@/lib/feedback/log-recoverable-failure";

/**
 * Recover from a thrown data-loader failure during RSC render.
 * Next.js redirect / notFound control-flow errors are rethrown.
 */
export async function runRscQuery<T>(
  operation: string,
  query: () => Promise<T>,
  fallback: T,
  context?: {
    route?: string;
    spotId?: string;
    claimId?: string;
  },
): Promise<T> {
  try {
    return await query();
  } catch (error) {
    unstable_rethrow(error);
    logRecoverableFailure("rsc", {
      operation,
      phase: "render",
      route: context?.route,
      spotId: context?.spotId,
      claimId: context?.claimId,
    });
    return fallback;
  }
}
