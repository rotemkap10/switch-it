"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { AppNav } from "@/components/layout/AppNav";
import { ModeGate } from "@/components/mode/ModeGate";
import { ModeProvider } from "@/components/mode/ModeProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { modeFromPathname } from "@/lib/mode/constants";

type AuthenticatedFrameProps = {
  userId: string;
  title: string;
  description: string;
  children?: ReactNode;
  layout?: "default" | "map";
  displayName?: string | null;
};

function ModeContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const modeKey = modeFromPathname(pathname) ?? "other";

  return (
    <div key={modeKey} className="flex min-h-0 flex-1 flex-col motion-mode-content">
      {children}
    </div>
  );
}

export function AuthenticatedFrame({
  userId,
  title,
  description,
  children,
  layout = "default",
  displayName = null,
}: AuthenticatedFrameProps) {
  const isMap = layout === "map";

  return (
    <ModeProvider userId={userId}>
      <ModeGate>
        <div
          className={[
            "flex min-h-full flex-1 flex-col",
            isMap ? "h-dvh max-h-dvh min-h-0 overflow-hidden" : "",
          ].join(" ")}
        >
          <AppNav compact={isMap} displayName={displayName} />
          <main
            className={[
              "mx-auto flex w-full flex-1 flex-col",
              isMap
                ? "relative min-h-0 max-w-none overflow-hidden p-0"
                : "max-w-5xl gap-6 px-4 py-8 sm:px-6",
            ].join(" ")}
          >
            <ModeContent>
              {isMap ? null : (
                <PageHeader title={title} description={description} />
              )}
              {children}
            </ModeContent>
          </main>
        </div>
      </ModeGate>
    </ModeProvider>
  );
}
