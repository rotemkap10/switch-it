"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

import { useFeedback } from "@/components/feedback/FeedbackProvider";
import { useOptionalPostClaimNavigation } from "@/components/map/PostClaimNavigationProvider";
import {
  SEEKER_PARKING_SPOT_NO_LONGER_AVAILABLE,
  subscribeSeekerHandoffTerminal,
} from "@/lib/handoff/seeker-handoff-terminal";

/**
 * Global seeker handoff teardown when a claim becomes terminal remotely
 * (publisher cancel, expiry, completion). Closes navigation UI, shows feedback,
 * and returns to Find parking when the seeker is on another route.
 */
export function SeekerHandoffTerminalController() {
  const router = useRouter();
  const pathname = usePathname();
  const { info } = useFeedback();
  const navigation = useOptionalPostClaimNavigation();

  useEffect(() => {
    return subscribeSeekerHandoffTerminal((event) => {
      navigation?.clearSession();

      if (event.reason === "publisher_cancel") {
        info(SEEKER_PARKING_SPOT_NO_LONGER_AVAILABLE);
      }

      if (pathname !== "/map") {
        router.replace("/map");
      }
    });
  }, [info, navigation, pathname, router]);

  return null;
}
