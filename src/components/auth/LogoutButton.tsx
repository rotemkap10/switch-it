"use client";

import { useFormStatus } from "react-dom";

import { logout } from "@/actions/auth";
import { Button } from "@/components/ui/Button";

function LogoutSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="secondary" loading={pending} disabled={pending}>
      {pending ? "Signing out…" : "Log out"}
    </Button>
  );
}

export function LogoutButton() {
  return (
    <form action={logout}>
      <LogoutSubmitButton />
    </form>
  );
}
