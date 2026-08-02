import { AuthenticatedShell } from "@/components/auth/AuthenticatedShell";

export default function ProfilePage() {
  return (
    <AuthenticatedShell
      title="Profile"
      description="Your profile and credit balance will appear here. This page is a placeholder."
    />
  );
}
