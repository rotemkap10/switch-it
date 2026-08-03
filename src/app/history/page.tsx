import { AuthenticatedShell } from "@/components/auth/AuthenticatedShell";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";

export default function HistoryPage() {
  return (
    <AuthenticatedShell
      title="History"
      description="Your spot and claim activity will appear here."
    >
      <Card>
        <Alert tone="info" title="Coming soon">
          Activity history is not built yet. Publishing, claiming, and
          completing handoffs already work from Map and Publish Spot.
        </Alert>
      </Card>
    </AuthenticatedShell>
  );
}
