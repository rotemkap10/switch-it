"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useFeedback } from "@/components/feedback/FeedbackProvider";
import {
  feedbackSuccessMessage,
  isFeedbackSuccessKey,
} from "@/lib/feedback/success-keys";
import { sensorySuccess } from "@/lib/sensory/feedback";

/**
 * Consumes allowlisted ?feedback= keys once, then cleans the URL.
 * Unknown keys are ignored (no arbitrary message injection).
 */
export function FeedbackUrlListener() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { success } = useFeedback();
  const consumedRef = useRef<string | null>(null);

  useEffect(() => {
    const key = searchParams.get("feedback");
    if (!key || !isFeedbackSuccessKey(key)) {
      return;
    }

    const token = `${pathname}?${key}`;
    if (consumedRef.current === token) {
      return;
    }
    consumedRef.current = token;

    success(feedbackSuccessMessage(key));
    if (key === "spot-published") {
      sensorySuccess();
    }

    const params = new URLSearchParams(searchParams.toString());
    params.delete("feedback");
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [searchParams, pathname, router, success]);

  return null;
}
