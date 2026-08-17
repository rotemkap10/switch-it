import { describe, expect, it, vi } from "vitest";

const maybeSingle = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: (table: string) => {
      expect(table).toBe("claims");
      return {
        select: () => ({
          eq: (column: string, value: string) => {
            expect(column).toBe("id");
            expect(value).toBe("7c611153-191e-430b-940e-ba25e5399571");
            return { maybeSingle };
          },
        }),
      };
    },
  }),
}));

import { reconcileHandoffFromPush } from "@/lib/push/reconcile";

describe("reconcileHandoffFromPush", () => {
  it("fetches current claim status instead of trusting the payload", async () => {
    maybeSingle.mockResolvedValue({
      data: { id: "7c611153-191e-430b-940e-ba25e5399571", status: "cancelled" },
      error: null,
    });
    const navigate = vi.fn();
    await reconcileHandoffFromPush(
      {
        type: "spot_cancelled",
        claimId: "7c611153-191e-430b-940e-ba25e5399571",
        spotId: "a0a29c9b-3257-4702-aa68-5edeaabe076c",
        recipientRole: "seeker",
      },
      navigate,
    );
    expect(maybeSingle).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith("/map");
  });
});
