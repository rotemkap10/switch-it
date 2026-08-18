import { AuthenticatedShell } from "@/components/auth/AuthenticatedShell";
import { HistoryList } from "@/components/history/HistoryList";
import { Alert } from "@/components/ui/Alert";
import { requireAuthenticatedVehicleAccess } from "@/lib/auth/vehicle-access";
import { loadHistoryItems } from "@/lib/history/load-history";

export default async function HistoryPage() {
  const access = await requireAuthenticatedVehicleAccess({
    mode: "require-complete",
  });

  const result = await loadHistoryItems(access.supabase);

  return (
    <AuthenticatedShell
      title="History"
      description="Your parking handoffs."
      access={access}
      headerAlign="center"
    >
      <div className="mx-auto w-full max-w-lg md:max-w-xl">
        {result.ok ? (
          <HistoryList
            items={result.items}
            hasMore={result.hasMore}
            nextCursor={result.nextCursor}
          />
        ) : (
          <Alert tone="error" title="Couldn’t load history">
            Something went wrong while loading your handoffs. Please try again.
          </Alert>
        )}
      </div>
    </AuthenticatedShell>
  );
}
