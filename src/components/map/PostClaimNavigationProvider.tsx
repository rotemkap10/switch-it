"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { NavigationProviderSheet } from "@/components/map/NavigationProviderSheet";
import {
  logPostClaimNavigationDev,
  offerPostClaimNavigation as publishPostClaimNavigationOffer,
  subscribePostClaimNavigation,
  type PostClaimNavigationOffer,
  type PostClaimNavigationSource,
} from "@/lib/map/post-claim-navigation";
import {
  buildExternalNavigationLinks,
  isValidNavigationCoords,
  openExternalNavigationUrl,
} from "@/lib/map/navigation-urls";

type NavigationSession = PostClaimNavigationOffer & {
  open: boolean;
  source: PostClaimNavigationSource;
};

type PostClaimNavigationContextValue = {
  session: NavigationSession | null;
  offerPostClaimNavigation: (offer: PostClaimNavigationOffer) => void;
  openManual: (offer: PostClaimNavigationOffer) => void;
  closeChooser: () => void;
};

const PostClaimNavigationContext =
  createContext<PostClaimNavigationContextValue | null>(null);

export function PostClaimNavigationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [session, setSession] = useState<NavigationSession | null>(null);

  const applyOffer = useCallback(
    (offer: PostClaimNavigationOffer, source: PostClaimNavigationSource) => {
      if (!isValidNavigationCoords(offer.latitude, offer.longitude)) {
        return;
      }
      logPostClaimNavigationDev(
        source === "post-claim"
          ? "navigation provider state opened"
          : "manual Open in opened",
      );
      setSession({ ...offer, open: true, source });
    },
    [],
  );

  useEffect(() => {
    return subscribePostClaimNavigation((offer) => {
      applyOffer(offer, "post-claim");
    });
  }, [applyOffer]);

  const offerFromUi = useCallback(
    (offer: PostClaimNavigationOffer) => {
      publishPostClaimNavigationOffer(offer);
    },
    [],
  );

  const openManual = useCallback(
    (offer: PostClaimNavigationOffer) => {
      applyOffer(offer, "manual");
    },
    [applyOffer],
  );

  const closeChooser = useCallback(() => {
    logPostClaimNavigationDev("navigation chooser closed");
    setSession((current) =>
      current ? { ...current, open: false, source: "manual" } : null,
    );
  }, []);

  const value = useMemo(
    () => ({
      session,
      offerPostClaimNavigation: offerFromUi,
      openManual,
      closeChooser,
    }),
    [session, offerFromUi, openManual, closeChooser],
  );

  const links =
    session && isValidNavigationCoords(session.latitude, session.longitude)
      ? buildExternalNavigationLinks(session.latitude, session.longitude)
      : null;

  return (
    <PostClaimNavigationContext.Provider value={value}>
      {children}
      {typeof document !== "undefined" && session?.open && links
        ? createPortal(
            <NavigationProviderSheet
              open
              onClose={closeChooser}
              links={links}
              title={session.source === "post-claim" ? "Spot claimed" : "Open in"}
              description={null}
              dismissLabel="Cancel"
              onChoose={(url) => {
                logPostClaimNavigationDev("provider selected");
                openExternalNavigationUrl(url);
                closeChooser();
              }}
            />,
            document.body,
          )
        : null}
    </PostClaimNavigationContext.Provider>
  );
}

export function usePostClaimNavigation(): PostClaimNavigationContextValue {
  const value = useContext(PostClaimNavigationContext);
  if (!value) {
    throw new Error(
      "usePostClaimNavigation must be used within PostClaimNavigationProvider",
    );
  }
  return value;
}

export function useOptionalPostClaimNavigation(): PostClaimNavigationContextValue | null {
  return useContext(PostClaimNavigationContext);
}
