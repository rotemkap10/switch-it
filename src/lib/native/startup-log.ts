/**
 * Cold-launch continuity diagnostics.
 * Always-on so Capacitor device Safari/Xcode consoles can prove logo handoff order.
 */
export function logStartup(
  stage: string,
  fields: Record<string, unknown> = {},
): void {
  console.info(`[switch-it:startup] ${stage}`, fields);
}
