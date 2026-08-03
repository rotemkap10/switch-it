"use client";

import type { ReactNode } from "react";

import { AppNav } from "@/components/layout/AppNav";
import { ModeGate } from "@/components/mode/ModeGate";
import { ModeProvider } from "@/components/mode/ModeProvider";
import { PageHeader } from "@/components/ui/PageHeader";

type AuthenticatedFrameProps = {
  userId: string;
  title: string;
  description: string;
  children?: ReactNode;
};

export function AuthenticatedFrame({
  userId,
  title,
  description,
  children,
}: AuthenticatedFrameProps) {
  return (
    <ModeProvider userId={userId}>
      <ModeGate>
        <div className="flex min-h-full flex-1 flex-col">
          <AppNav />
          <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
            <PageHeader title={title} description={description} />
            {children}
          </main>
        </div>
      </ModeGate>
    </ModeProvider>
  );
}
