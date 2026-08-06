"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { AppNav } from "@/components/layout/AppNav";
import { MapLibreWarmup } from "@/components/map/MapLibreWarmup";
import { ModeGate } from "@/components/mode/ModeGate";
import { ModeProvider } from "@/components/mode/ModeProvider";
import { CoreRoutePrefetch } from "@/components/navigation/CoreRoutePrefetch";
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
          className={["app-shell", isMap ? "app-shell--map" : ""].join(" ")}
          data-testid="authenticated-shell"
          data-layout={isMap ? "map" : "page"}
        >
          <AppNav compact={isMap} displayName={displayName} />
          <main
            className={[
              "app-shell-main",
              isMap ? "app-shell-main--map" : "app-shell-main--page",
            ].join(" ")}
            data-testid="authenticated-main"
          >
            <ModeContent>
              {isMap ? null : (
                <PageHeader title={title} description={description} />
              )}
              {children}
            </ModeContent>
          </main>
          <CoreRoutePrefetch />
          <MapLibreWarmup />
        </div>
      </ModeGate>
    </ModeProvider>
  );
}
