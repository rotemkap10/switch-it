import type { ReactNode } from "react";

import { AuthenticatedFrame } from "@/components/auth/AuthenticatedFrame";
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
  const { user } = await requireUser();

  return (
    <AuthenticatedFrame
      userId={user.id}
      title={title}
      description={description}
    >
      {children}
    </AuthenticatedFrame>
  );
}
