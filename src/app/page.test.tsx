import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const replaceMock = vi.fn();
let authStateCallback: ((event: string, session: unknown) => void) | null =
  null;
const getSessionMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: getSessionMock,
      onAuthStateChange: (_cb: (event: string, session: unknown) => void) => {
        authStateCallback = _cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
    },
  }),
}));

import HomePage from "@/app/page";
import { FEEDBACK_SUCCESS_KEYS } from "@/lib/feedback/success-keys";

function mockNoSession() {
  replaceMock.mockReset();
  getSessionMock.mockResolvedValue({ data: { session: null } });
  authStateCallback = null;
}

describe("landing page", () => {
  it("leads with the brand and two CTAs only", async () => {
    mockNoSession();
    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByTestId("landing-page")).toBeInTheDocument();
    });

    expect(screen.getByTestId("landing-page")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Switch It" }),
    ).toBeInTheDocument();
    const signIn = screen.getByRole("link", { name: "Sign in" });
    const createAccount = screen.getByRole("link", { name: "Create account" });
    expect(signIn).toHaveAttribute("href", "/login");
    expect(createAccount).toHaveAttribute("href", "/register");
    expect(signIn.compareDocumentPosition(createAccount)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(signIn.querySelector("button")).not.toHaveClass("border-border");
    expect(createAccount.querySelector("button")).toHaveClass("border-border");
    expect(screen.queryByText(/never sells or guarantees/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Find parking/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Share a spot/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Confirm the handoff/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Find a spot someone is leaving/i),
    ).not.toBeInTheDocument();
  });
});

describe("startup auth routing", () => {
  it("valid existing session routes directly to /map", async () => {
    replaceMock.mockReset();
    authStateCallback = null;
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: "test" } },
    });

    render(<HomePage />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/map");
    });

    expect(screen.queryByTestId("landing-page")).not.toBeInTheDocument();
  });

  it("no session shows auth landing page", async () => {
    mockNoSession();
    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByTestId("landing-page")).toBeInTheDocument();
    });
  });

  it("auth hydration/loading does not prematurely render auth landing", async () => {
    replaceMock.mockReset();
    authStateCallback = null;

    let resolveSession: (v: unknown) => void = () => {};
    getSessionMock.mockReturnValue(
      new Promise((resolve) => {
        resolveSession = resolve;
      }) as never,
    );

    render(<HomePage />);

    expect(screen.queryByTestId("landing-page")).not.toBeInTheDocument();
    expect(screen.getByTestId("home-auth-routing")).toBeInTheDocument();

    resolveSession({ data: { session: null } });
    await waitFor(() => {
      expect(screen.getByTestId("landing-page")).toBeInTheDocument();
    });
  });

  it("does not signal shell ready while session is still resolving", async () => {
    replaceMock.mockReset();
    authStateCallback = null;

    let resolveSession: (v: unknown) => void = () => {};
    getSessionMock.mockReturnValue(
      new Promise((resolve) => {
        resolveSession = resolve;
      }) as never,
    );

    render(<HomePage />);

    expect(screen.getByTestId("home-auth-routing")).toBeInTheDocument();
    // No InitialShellReadyMarker during checking — splash must stay covering.
    expect(screen.queryByTestId("landing-page")).not.toBeInTheDocument();

    resolveSession({ data: { session: { access_token: "test" } } });
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/map");
    });
    expect(screen.queryByTestId("landing-page")).not.toBeInTheDocument();
  });

  it("logout returns to auth landing again", async () => {
    replaceMock.mockReset();

    getSessionMock.mockResolvedValue({
      data: { session: { access_token: "test" } },
    });
    authStateCallback = null;

    render(<HomePage />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/map");
    });

    // Simulate explicit logout which sets the session to null.
    authStateCallback?.("SIGNED_OUT", null);

    await waitFor(() => {
      expect(screen.getByTestId("landing-page")).toBeInTheDocument();
    });
  });
});

describe("Phase 10 terminal feedback copy", () => {
  it("uses clear completion and cancellation messages", () => {
    expect(FEEDBACK_SUCCESS_KEYS["handoff-completed"]).toContain(
      "Parking handoff complete",
    );
    expect(FEEDBACK_SUCCESS_KEYS["handoff-completed"]).toContain(
      "1 credit was used",
    );
    expect(FEEDBACK_SUCCESS_KEYS["handoff-cancelled-publisher"]).toContain(
      "Spot cancelled",
    );
    expect(FEEDBACK_SUCCESS_KEYS["claim-cancelled"]).toContain("Spot released");
  });

  it("does not expose Phase 9C routing keys", () => {
    expect(
      Object.keys(FEEDBACK_SUCCESS_KEYS).some((key) =>
        /route|eta|google/i.test(key),
      ),
    ).toBe(false);
  });
});
