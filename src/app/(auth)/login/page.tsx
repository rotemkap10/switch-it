import Link from "next/link";

import { LoginForm } from "@/components/auth/LoginForm";
import { getSafeRedirectPath } from "@/lib/auth/safe-redirect";

type LoginPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = getSafeRedirectPath(params.next);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Welcome back to Switch It.
        </p>
      </div>

      <LoginForm next={next} />

      <p className="text-sm text-zinc-600">
        No account yet?{" "}
        <Link href="/register" className="font-medium text-zinc-900 underline">
          Create one
        </Link>
      </p>
    </main>
  );
}
