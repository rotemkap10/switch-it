import { AuthenticatedShell } from "@/components/auth/AuthenticatedShell";

export default function MapPage() {
  return (
    <AuthenticatedShell
      title="Map"
      description="Available parking spots will appear here. This page is a placeholder while authentication is being verified."
    />
  );
}
