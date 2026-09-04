import "@testing-library/jest-dom/vitest";
import { createElement } from "react";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

import { resetHandoffCompletionSuccessForTests } from "@/lib/handoff/handoff-completion-success";
import { resetHandoffTerminalEndedForTests } from "@/lib/handoff/handoff-terminal-ended";
import { resetSeekerMapPresentationForTests } from "@/lib/map/seeker-map-presentation";

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    className,
    width,
    height,
  }: {
    src: string;
    alt: string;
    className?: string;
    width?: number;
    height?: number;
  }) =>
    createElement("img", {
      src,
      alt,
      className,
      width,
      height,
    }),
}));

afterEach(() => {
  resetHandoffCompletionSuccessForTests();
  resetHandoffTerminalEndedForTests();
  resetSeekerMapPresentationForTests();
  cleanup();
});
