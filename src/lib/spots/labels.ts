import {
  LEAVE_DELAY_MAX_MINUTES,
  LEAVE_DELAY_MIN_MINUTES,
} from "@/lib/spots/constants";

/** Accessible / display label for the leave-delay slider value. */
export function leaveDelayValueText(minutes: number): string {
  if (minutes <= 0) {
    return "Now";
  }
  if (minutes === 1) {
    return "In 1 minute";
  }
  return `In ${minutes} minutes`;
}

export const LEAVE_DELAY_RANGE = {
  min: LEAVE_DELAY_MIN_MINUTES,
  max: LEAVE_DELAY_MAX_MINUTES,
  step: 1,
} as const;
