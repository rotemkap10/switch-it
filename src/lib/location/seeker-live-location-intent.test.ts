import { afterEach, describe, expect, it, vi } from "vitest";

import {
  registerSeekerLiveLocationStarter,
  requestSeekerLiveLocationStart,
  resetSeekerLiveLocationIntentForTests,
} from "@/lib/location/seeker-live-location-intent";

describe("seeker live location intent", () => {
  afterEach(() => {
    resetSeekerLiveLocationIntentForTests();
  });

  it("starts immediately when a starter is registered", () => {
    const start = vi.fn();
    const unregister = registerSeekerLiveLocationStarter(start);
    requestSeekerLiveLocationStart();
    expect(start).toHaveBeenCalledTimes(1);
    unregister();
  });

  it("queues start until the active claim registers", () => {
    requestSeekerLiveLocationStart();
    const start = vi.fn();
    registerSeekerLiveLocationStarter(start);
    expect(start).toHaveBeenCalledTimes(1);
  });

  it("does not throw when the starter fails", () => {
    registerSeekerLiveLocationStarter(() => {
      throw new Error("geolocation denied");
    });
    expect(() => requestSeekerLiveLocationStart()).not.toThrow();
  });
});
