const PREPROMPT_KEY = "switch-it:push-preprompt-shown";

export function hasShownHandoffPushPreprompt(): boolean {
  if (typeof window === "undefined") {
    return true;
  }
  try {
    return window.localStorage.getItem(PREPROMPT_KEY) === "1";
  } catch {
    return true;
  }
}

export function markHandoffPushPrepromptShown(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(PREPROMPT_KEY, "1");
  } catch {
    // ignore quota / private mode
  }
}

export function resetHandoffPushPrepromptShownForTests(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(PREPROMPT_KEY);
}
