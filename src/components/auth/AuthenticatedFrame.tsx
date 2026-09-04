"use client";

import type { ReactNode } from "react";

import { HandoffPushController } from "@/components/push/HandoffPushController";
import { SeekerHandoffTerminalController } from "@/components/handoff/SeekerHandoffTerminalController";
import { AppNav } from "@/components/layout/AppNav";
import { MapLibreWarmup } from "@/components/map/MapLibreWarmup";
import { ModeGate } from "@/components/mode/ModeGate";
import { ModeProvider } from "@/components/mode/ModeProvider";
import { CoreRoutePrefetch } from "@/components/navigation/CoreRoutePrefetch";
import { SecondaryPageTransition } from "@/components/shell/SecondaryPageTransition";
import { PageHeader } from "@/components/ui/PageHeader";

type AuthenticatedFrameProps = {
  userId: string;
  title: string;
  description?: string;
  children?: ReactNode;
  layout?: "default" | "map";
  displayName?: string | null;
  /** Authoritative profiles.credits. Null while the shell query is unavailable. */
  credits?: number | null;
  hasActiveHandoff?: boolean;
  headerAlign?: "start" | "center";
};

export function AuthenticatedFrame({
  userId,
  title,
  description,
  children,
  layout = "default",
  displayName = null,
  credits = null,
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
          <AppNav compact={isMap} displayName={displayName} credits={credits} />
          <main
            className={[
              "app-shell-main",
              isMap ? "app-shell-main--map" : "app-shell-main--page",
            ].join(" ")}
            data-testid="authenticated-main"
          >
            <SecondaryPageTransition>
              {isMap ? null : (
                <PageHeader
                  title={title}
                  description={description}
                  align={headerAlign}
                />
              )}
              {children}
            </SecondaryPageTransition>
          </main>
          <CoreRoutePrefetch />
          <MapLibreWarmup />
          <HandoffPushController
            userId={userId}
            hasActiveHandoff={hasActiveHandoff}
          />
          <SeekerHandoffTerminalController />
        </div>
      </ModeGate>
    </ModeProvider>
  );
}
