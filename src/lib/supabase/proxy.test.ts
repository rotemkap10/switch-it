import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServerClientMock, getUserMock } = vi.hoisted(() => ({
  createServerClientMock: vi.fn(),
  getUserMock: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: createServerClientMock,
}));

import { updateSession } from "@/lib/supabase/proxy";

function request(path: string) {
  return new NextRequest(`https://app.example${path}`);
}

describe("updateSession proxy redirects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    createServerClientMock.mockReturnValue({
      auth: {
        getUser: getUserMock,
      },
    });
  });

  it("does not redirect authenticated recovery sessions away from set-new-password", async () => {
    const response = await updateSession(request("/auth/reset-password"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("still redirects authenticated users away from login/register/forgot-password", async () => {
    for (const path of ["/login", "/register", "/forgot-password"]) {
      const response = await updateSession(request(path));
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("https://app.example/map");
    }
  });
});
