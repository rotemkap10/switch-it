import Link from "next/link";

import { LoginForm } from "@/components/auth/LoginForm";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { getSafeRedirectPath } from "@/lib/auth/safe-redirect";

type LoginPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = getSafeRedirectPath(params.next);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-12 sm:px-6">
      <PageHeader
        title="Sign in"
        description="Welcome back to Switch It."
      />
      <Card>
        <LoginForm next={next} />
      </Card>
      <p className="text-sm text-muted">
        No account yet?{" "}
        <Link href="/register" className="font-medium text-accent-hover underline">
          Create one
        </Link>
      </p>
    </main>
  );
}
