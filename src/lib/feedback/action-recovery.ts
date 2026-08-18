import { unstable_rethrow } from "next/navigation";

import {
  GENERIC_APP_ERROR,
  mapAppError,
  type AppErrorLike,
} from "@/lib/feedback/error-map";
import { logRecoverableFailure } from "@/lib/feedback/log-recoverable-failure";

export type ActionFailure = {
  error: string;
  errorCode: string;
};

function toAppErrorLike(error: unknown): AppErrorLike | string | null {
  if (error == null) {
    return null;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error instanceof Error) {
    const code =
      "code" in error && typeof error.code === "string" ? error.code : undefined;
    return { message: error.message, code };
  }
  if (typeof error === "object") {
    const record = error as {
      message?: unknown;
      code?: unknown;
      details?: unknown;
      hint?: unknown;
    };
    return {
      message: typeof record.message === "string" ? record.message : undefined,
      code: typeof record.code === "string" ? record.code : undefined,
      details: typeof record.details === "string" ? record.details : undefined,
      hint: typeof record.hint === "string" ? record.hint : undefined,
    };
  }
  return String(error);
}

/**
 * Convert an unexpected throw into an action-state error.
 * Next.js redirect / notFound / HTTP control-flow errors are rethrown.
 */
export function actionErrorFromUnknown(
  error: unknown,
  fallback: string = GENERIC_APP_ERROR,
  context: {
    operation: string;
    spotId?: string;
    claimId?: string;
  },
): ActionFailure {
  unstable_rethrow(error);
  const mapped = mapAppError(toAppErrorLike(error), fallback);
  logRecoverableFailure("action", {
    operation: context.operation,
    phase: "mutation",
    code: mapped.code,
    spotId: context.spotId,
    claimId: context.claimId,
  });
  return { error: mapped.message, errorCode: mapped.code };
}

export async function runHandoffAction<T>(
  operation: string,
  fallback: string,
  context: { spotId?: string; claimId?: string },
  run: () => Promise<T>,
): Promise<T | ActionFailure> {
  try {
    return await run();
  } catch (error) {
    return actionErrorFromUnknown(error, fallback, { operation, ...context });
  }
}
