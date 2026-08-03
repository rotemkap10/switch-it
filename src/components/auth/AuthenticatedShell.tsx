import type { ReactNode } from "react";

import { AppNav } from "@/components/layout/AppNav";
import { PageHeader } from "@/components/ui/PageHeader";
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
    <div className="flex min-h-full flex-1 flex-col">
      <AppNav />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <PageHeader title={title} description={description} />
        {children}
      </main>
    </div>
  );
}
