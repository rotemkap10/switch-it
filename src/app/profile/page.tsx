import { AuthenticatedShell } from "@/components/auth/AuthenticatedShell";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { requireUser } from "@/lib/auth/require-user";

export default async function ProfilePage() {
  const { supabase, user } = await requireUser();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("display_name, credits, role")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile) {
    return (
      <AuthenticatedShell
        title="Profile"
        description="Manage your Switch It account details."
      >
        <p className="text-sm text-red-600" role="alert">
          Your profile could not be loaded.
        </p>
      </AuthenticatedShell>
    );
  }

  return (
    <AuthenticatedShell
      title="Profile"
      description="Manage your Switch It account details."
    >
      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <div className="rounded border border-zinc-200 p-4">
          <dt className="font-medium text-zinc-500">Email</dt>
          <dd className="mt-1 text-zinc-900">{user.email ?? "—"}</dd>
        </div>
        <div className="rounded border border-zinc-200 p-4">
          <dt className="font-medium text-zinc-500">Credits</dt>
          <dd className="mt-1 text-zinc-900">{profile.credits}</dd>
        </div>
        <div className="rounded border border-zinc-200 p-4 sm:col-span-2">
          <dt className="font-medium text-zinc-500">Role</dt>
          <dd className="mt-1 text-zinc-900">{profile.role}</dd>
        </div>
      </dl>

      <section className="mt-2 flex flex-col gap-3">
        <h2 className="text-base font-semibold tracking-tight">
          Edit display name
        </h2>
        <ProfileForm initialDisplayName={profile.display_name} />
      </section>
    </AuthenticatedShell>
  );
}
