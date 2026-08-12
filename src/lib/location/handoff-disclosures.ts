import { isNativeHandoffPlatform } from "@/lib/location/is-native-handoff-platform";

export const WEB_HANDOFF_LOCATION_DISCLOSURE =
  "Share your live location while you drive to the parking spot so the other driver knows when you're approaching. Sharing pauses if you leave Switch It.";

export const NATIVE_HANDOFF_LOCATION_DISCLOSURE =
  "Share your live location while you drive to the parking spot so the other driver knows when you're approaching.";

export function getHandoffLocationDisclosure(): string {
  return isNativeHandoffPlatform()
    ? NATIVE_HANDOFF_LOCATION_DISCLOSURE
    : WEB_HANDOFF_LOCATION_DISCLOSURE;
}

export const ANDROID_HANDOFF_NOTIFICATION_TITLE = "Switch It";
export const ANDROID_HANDOFF_NOTIFICATION_TEXT =
  "Sharing location for active parking handoff";
