export function logPush(
  message: string,
  detail?: Record<string, unknown>,
): void {
  if (detail) {
    console.info(`[switch-it:push] ${message}`, detail);
    return;
  }
  console.info(`[switch-it:push] ${message}`);
}

export function tokenSuffix(token: string): string {
  if (token.length <= 8) {
    return "****";
  }
  return token.slice(-6);
}
