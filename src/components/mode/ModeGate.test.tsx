import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const requestAwaitInitialMap = vi.hoisted(() => vi.fn());
const reportInitialShellReady = vi.hoisted(() => vi.fn());
const pathnameRef = vi.hoisted(() => ({ current: "/map" }));
const modeReadyRef = vi.hoisted(() => ({ current: true }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameRef.current,
}));

vi.mock("@/components/mode/ModeProvider", () => ({
  useMode: () => ({ ready: modeReadyRef.current, mode: "seeker" }),
}));

vi.mock("@/components/shell/AppLaunchReadyContext", () => ({
  useReportInitialShellReady: () => reportInitialShellReady,
  useRequestAwaitInitialMap: () => requestAwaitInitialMap,
}));

import { ModeGate } from "@/components/mode/ModeGate";

describe("ModeGate cold-launch map coordination", () => {
  it("requests await-initial-map on /map before reporting shell ready", () => {
    pathnameRef.current = "/map";
    modeReadyRef.current = true;
    requestAwaitInitialMap.mockClear();
    reportInitialShellReady.mockClear();

    render(
      <ModeGate>
        <p>Map children</p>
      </ModeGate>,
    );

    expect(requestAwaitInitialMap).toHaveBeenCalled();
    expect(reportInitialShellReady).toHaveBeenCalled();
  });

  it("does not await map on profile / non-map routes", () => {
    pathnameRef.current = "/profile";
    modeReadyRef.current = true;
    requestAwaitInitialMap.mockClear();
    reportInitialShellReady.mockClear();

    render(
      <ModeGate>
        <p>Profile children</p>
      </ModeGate>,
    );

    expect(requestAwaitInitialMap).not.toHaveBeenCalled();
    expect(reportInitialShellReady).toHaveBeenCalled();
  });
});
