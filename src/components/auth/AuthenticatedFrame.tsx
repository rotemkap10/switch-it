"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { HandoffPushController } from "@/components/push/HandoffPushController";
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
  description?: string;
  children?: ReactNode;
  layout?: "default" | "map";
  displayName?: string | null;
  hasActiveHandoff?: boolean;
  headerAlign?: "start" | "center";
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
  hasActiveHandoff = false,
  headerAlign = "start",
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
                <PageHeader
                  title={title}
                  description={description}
                  align={headerAlign}
                />
              )}
              {children}
            </ModeContent>
          </main>
          <CoreRoutePrefetch />
          <MapLibreWarmup />
          <HandoffPushController
            userId={userId}
            hasActiveHandoff={hasActiveHandoff}
          />
        </div>
      </ModeGate>
    </ModeProvider>
  );
}
