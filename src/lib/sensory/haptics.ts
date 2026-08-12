import { isNativeHandoffPlatform } from "@/lib/location/is-native-handoff-platform";

export type SensoryHapticKind = "light" | "medium" | "success";

/**
 * Native Capacitor haptics on iOS/Android.
 * Web/PWA: no-op. Failures never throw.
 */
export async function triggerSensoryHaptic(
  kind: SensoryHapticKind,
): Promise<void> {
  if (!isNativeHandoffPlatform()) {
    return;
  }

  try {
    const { Haptics, ImpactStyle, NotificationType } = await import(
      "@capacitor/haptics"
    );

    if (kind === "success") {
      await Haptics.notification({ type: NotificationType.Success });
      return;
    }

    await Haptics.impact({
      style: kind === "medium" ? ImpactStyle.Medium : ImpactStyle.Light,
    });
  } catch {
    // Plugin missing, web stub, or native failure — skip.
  }
}
