import type { ReactNode } from "react";

import { AuthenticatedFrame } from "@/components/auth/AuthenticatedFrame";
import { requireUser } from "@/lib/auth/require-user";

type AuthenticatedShellProps = {
  title: string;
  description: string;
  children?: ReactNode;
  /** Immersive map layout: no page header, full-height main. */
  layout?: "default" | "map";
};

export async function AuthenticatedShell({
  title,
  description,
  children,
  layout = "default",
}: AuthenticatedShellProps) {
  const { user } = await requireUser();

  return (
    <AuthenticatedFrame
      userId={user.id}
      title={title}
      description={description}
      layout={layout}
    >
      {children}
    </AuthenticatedFrame>
  );
}
