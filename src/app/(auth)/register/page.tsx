import Link from "next/link";

import { RegisterForm } from "@/components/auth/RegisterForm";
import { Card } from "@/components/ui/Card";

export default function RegisterPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-12 sm:px-6">
      <div className="space-y-2">
        <p className="text-sm font-medium text-accent-hover">Step 1 of 2</p>
        <h1 className="text-2xl font-semibold text-foreground">
          Create your account
        </h1>
        <p className="text-sm text-muted">
          You&apos;ll add your vehicle in the next step.
        </p>
      </div>
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
