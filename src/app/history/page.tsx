import { AuthenticatedShell } from "@/components/auth/AuthenticatedShell";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";

export default function HistoryPage() {
  return (
    <AuthenticatedShell
      title="Activity"
      description="Your recent parking activity will appear here."
    >
      <Card>
        <Alert tone="info" title="Coming soon">
          Activity history is not built yet. Finding and sharing spots already
          work from the map and My parking spot pages.
        </Alert>
      </Card>
    </AuthenticatedShell>
  );
}
