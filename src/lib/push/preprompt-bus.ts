type PrepromptHandler = () => Promise<void>;

let handler: PrepromptHandler | null = null;

export function registerHandoffPushPrepromptHandler(
  next: PrepromptHandler | null,
): void {
  handler = next;
}

/** Resolves immediately on web or after the user dismisses/accepts the preprompt. */
export async function offerHandoffPushPrepromptBeforeHandoff(): Promise<void> {
  if (!handler) {
    return;
  }
  await handler();
}
