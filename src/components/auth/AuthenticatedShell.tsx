import Link from "next/link";
import type { ReactNode } from "react";

import { LogoutButton } from "@/components/auth/LogoutButton";
import { requireUser } from "@/lib/auth/require-user";

type AuthenticatedShellProps = {
  title: string;
  description: string;
  children?: ReactNode;
};

export async function AuthenticatedShell({
  title,
  description,
  children,
}: AuthenticatedShellProps) {
  await requireUser();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Switch It
        </Link>
        <nav className="flex flex-wrap items-center gap-3 text-sm">
          <Link href="/map" className="underline">
            Map
          </Link>
          <Link href="/spots/new" className="underline">
            Publish
          </Link>
          <Link href="/profile" className="underline">
            Profile
          </Link>
          <Link href="/history" className="underline">
            History
          </Link>
          <LogoutButton />
        </nav>
      </header>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-zinc-600">{description}</p>
      </div>

      {children}
    </main>
  );
}
