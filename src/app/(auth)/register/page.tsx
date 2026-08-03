import Link from "next/link";

import { RegisterForm } from "@/components/auth/RegisterForm";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

export default function RegisterPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-12 sm:px-6">
      <PageHeader
        title="Create an account"
        description="Start coordinating parking handoffs with Switch It."
      />
      <Card>
        <RegisterForm />
      </Card>
      <p className="text-sm text-muted">
        Already registered?{" "}
        <Link href="/login" className="font-medium text-accent-hover underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
