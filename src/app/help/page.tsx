import { AuthenticatedShell } from "@/components/auth/AuthenticatedShell";
import { HelpSafetyContent } from "@/components/help/HelpSafetyContent";

export default function HelpPage() {
  return (
    <AuthenticatedShell
      title="Help & Safety"
      vehicleAccess="allow-incomplete"
      headerAlign="center"
    >
      <HelpSafetyContent />
    </AuthenticatedShell>
  );
}
