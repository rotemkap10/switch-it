import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HelpSafetyContent } from "@/components/help/HelpSafetyContent";

function source(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("HelpSafetyContent", () => {
  it("covers current timing, verification, and credit rules", () => {
    render(<HelpSafetyContent />);

    const page = screen.getByTestId("help-safety-page");
    expect(page.className).toContain("help-page");
    expect(source("src/app/globals.css")).toMatch(
      /\.help-page\s*\{[^}]*overflow-x:\s*hidden/s,
    );

    expect(screen.getByTestId("help-section-how")).toHaveTextContent(
      "Share",
    );
    expect(screen.getByTestId("help-section-how")).toHaveTextContent(
      "Navigate to spot",
    );
    expect(screen.getByTestId("help-section-how")).toHaveTextContent("Waze");

    expect(screen.getByTestId("help-section-timing")).toHaveTextContent(
      "Now–10 minutes",
    );
    expect(screen.getByTestId("help-section-timing")).toHaveTextContent(
      "3 minutes",
    );
    expect(screen.getByTestId("help-section-timing")).toHaveTextContent(
      "I'm leaving now",
    );
    expect(screen.getByTestId("help-section-timing")).toHaveTextContent(
      "Wait 2 more min",
    );
    expect(screen.getByTestId("help-section-timing")).toHaveTextContent(
      "5 minutes",
    );

    expect(screen.getByTestId("help-section-complete")).toHaveTextContent(
      "generic illustration",
    );

    expect(screen.getByTestId("help-section-complete")).toHaveTextContent(
      "last 2 plate digits",
    );
    expect(screen.getByTestId("help-section-complete")).toHaveTextContent(
      "Confirm handoff",
    );
    expect(screen.getByTestId("help-section-complete")).toHaveTextContent(
      "masked",
    );

    expect(screen.getByTestId("help-section-credits")).toHaveTextContent(
      "does not spend a credit",
    );
    expect(screen.getByTestId("help-section-credits")).toHaveTextContent(
      "Release spot",
    );

    expect(screen.getByTestId("help-section-safety")).toHaveTextContent(
      "does not reserve",
    );
  });

  it("does not mention retired verification or photo-upload copy", () => {
    const { container } = render(<HelpSafetyContent />);
    const text = container.textContent ?? "";

    expect(text).not.toMatch(/5-digit/i);
    expect(text).not.toMatch(/verification code/i);
    expect(text).not.toMatch(/uploaded vehicle/i);
    expect(text).not.toMatch(/upload.*photo/i);
    expect(text).not.toMatch(/2-minute initial/i);
  });
});

describe("Help & Safety route wiring", () => {
  it("uses the authenticated shell, centered title, and branded page loader", () => {
    const page = source("src/app/help/page.tsx");
    const loading = source("src/app/help/loading.tsx");
    const profile = source("src/app/profile/page.tsx");
    const proxy = source("src/lib/supabase/proxy.ts");

    expect(page).toContain("<AuthenticatedShell");
    expect(page).toContain('title="Help & Safety"');
    expect(page).toContain('headerAlign="center"');
    expect(page).toContain('vehicleAccess="allow-incomplete"');
    expect(page).not.toContain("<AppNav");
    expect(loading).toContain("PageRouteLoadingChrome");
    expect(loading).toContain("help-loading-shell");
    expect(profile).not.toContain("ProfileHelpLink");
    expect(profile).not.toContain("Help & Safety");
    expect(proxy).toContain('"/help"');
  });
});
