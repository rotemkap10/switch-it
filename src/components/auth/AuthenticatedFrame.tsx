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
  layout?: "default" | "map";
};

export function AuthenticatedFrame({
  userId,
  title,
  description,
  children,
  layout = "default",
}: AuthenticatedFrameProps) {
  const isMap = layout === "map";

  return (
    <ModeProvider userId={userId}>
      <ModeGate>
        <div
          className={[
            "flex min-h-full flex-1 flex-col",
            isMap ? "h-dvh max-h-dvh overflow-hidden" : "",
          ].join(" ")}
        >
          <AppNav compact={isMap} />
          <main
            className={[
              "mx-auto flex w-full flex-1 flex-col",
              isMap
                ? [
                    "min-h-0 max-w-none overflow-hidden p-0",
                    // Reserve space for the fixed mobile bottom nav.
                    "pb-[calc(var(--app-bottom-nav-height)+env(safe-area-inset-bottom,0px))] md:pb-0",
                  ].join(" ")
                : "max-w-5xl gap-6 px-4 py-8 sm:px-6",
            ].join(" ")}
          >
            {isMap ? null : (
              <PageHeader title={title} description={description} />
            )}
            {children}
          </main>
        </div>
      </ModeGate>
    </ModeProvider>
  );
}
