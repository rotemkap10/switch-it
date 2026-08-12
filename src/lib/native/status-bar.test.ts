import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const statusBarMocks = vi.hoisted(() => ({
  setOverlaysWebView: vi.fn(async () => undefined),
  setStyle: vi.fn(async () => undefined),
  Style: { Light: "LIGHT", Dark: "DARK", Default: "DEFAULT" },
}));

vi.mock("@capacitor/status-bar", () => ({
  StatusBar: {
    setOverlaysWebView: statusBarMocks.setOverlaysWebView,
    setStyle: statusBarMocks.setStyle,
  },
  Style: statusBarMocks.Style,
}));

vi.mock("@/lib/location/is-native-handoff-platform", () => ({
  isNativeHandoffPlatform: vi.fn(() => false),
}));

import { isNativeHandoffPlatform } from "@/lib/location/is-native-handoff-platform";
import {
  configureNativeStatusBar,
  isNativeStatusBarInsetOwned,
  markNativeStatusBarInsetOwned,
  NATIVE_STATUS_BAR_INSET_ATTR,
  NATIVE_STATUS_BAR_INSET_VALUE,
} from "@/lib/native/status-bar";

describe("configureNativeStatusBar", () => {
  beforeEach(() => {
    statusBarMocks.setOverlaysWebView.mockClear();
    statusBarMocks.setStyle.mockClear();
    vi.mocked(isNativeHandoffPlatform).mockReturnValue(false);
    document.documentElement.removeAttribute(NATIVE_STATUS_BAR_INSET_ATTR);
    delete (window as unknown as { Capacitor?: unknown }).Capacitor;
  });

  afterEach(() => {
    document.documentElement.removeAttribute(NATIVE_STATUS_BAR_INSET_ATTR);
    delete (window as unknown as { Capacitor?: unknown }).Capacitor;
  });

  it("does nothing on web / PWA", async () => {
    await configureNativeStatusBar();
    expect(statusBarMocks.setOverlaysWebView).not.toHaveBeenCalled();
    expect(isNativeStatusBarInsetOwned()).toBe(false);
  });

  it("does nothing on native Android", async () => {
    vi.mocked(isNativeHandoffPlatform).mockReturnValue(true);
    (window as unknown as { Capacitor: { getPlatform: () => string } }).Capacitor =
      { getPlatform: () => "android" };

    await configureNativeStatusBar();
    expect(statusBarMocks.setOverlaysWebView).not.toHaveBeenCalled();
    expect(isNativeStatusBarInsetOwned()).toBe(false);
  });

  it("disables iOS WebView overlay and uses dark status-bar content", async () => {
    vi.mocked(isNativeHandoffPlatform).mockReturnValue(true);
    (window as unknown as { Capacitor: { getPlatform: () => string } }).Capacitor =
      { getPlatform: () => "ios" };

    await configureNativeStatusBar();

    expect(statusBarMocks.setOverlaysWebView).toHaveBeenCalledWith({
      overlay: false,
    });
    expect(statusBarMocks.setStyle).toHaveBeenCalledWith({
      style: "LIGHT",
    });
    expect(isNativeStatusBarInsetOwned()).toBe(true);
    expect(
      document.documentElement.getAttribute(NATIVE_STATUS_BAR_INSET_ATTR),
    ).toBe(NATIVE_STATUS_BAR_INSET_VALUE);
  });

  it("markNativeStatusBarInsetOwned sets the document flag", () => {
    markNativeStatusBarInsetOwned();
    expect(isNativeStatusBarInsetOwned()).toBe(true);
  });
});
