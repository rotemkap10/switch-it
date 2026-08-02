import { AuthenticatedShell } from "@/components/auth/AuthenticatedShell";
import { PublishSpotForm } from "@/components/spots/PublishSpotForm";
import { requireUser } from "@/lib/auth/require-user";

export default async function NewSpotPage() {
  await requireUser();

  return (
    <AuthenticatedShell
      title="Publish a spot"
      description="Share a public street parking spot you are about to leave. This coordinates a handoff—it does not reserve or sell the spot."
    >
      <PublishSpotForm />
    </AuthenticatedShell>
  );
}
