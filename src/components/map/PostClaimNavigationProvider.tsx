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
import { getHandoffLocationDisclosure } from "@/lib/location/handoff-disclosures";
import { requestSeekerLiveLocationStart } from "@/lib/location/seeker-live-location-intent";
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
  type NavigationProviderId,
} from "@/lib/map/navigation-urls";

type NavigationSession = PostClaimNavigationOffer & {
  open: boolean;
  source: PostClaimNavigationSource;
  providerSelected: boolean;
  selectedProviderId: NavigationProviderId | null;
};

type PostClaimNavigationContextValue = {
  session: NavigationSession | null;
  offerPostClaimNavigation: (offer: PostClaimNavigationOffer) => void;
  openManual: (offer: PostClaimNavigationOffer) => void;
  relaunchSelected: () => boolean;
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
      setSession((current) => {
        const sameClaim = current?.claimId === offer.claimId;
        return {
          ...offer,
          open: true,
          source,
          providerSelected: sameClaim ? current.providerSelected : false,
          selectedProviderId: sameClaim ? current.selectedProviderId : null,
        };
      });
    },
    [],
  );

  useEffect(() => {
    return subscribePostClaimNavigation((offer) => {
      applyOffer(offer, "post-claim");
    });
  }, [applyOffer]);

  const offerFromUi = useCallback((offer: PostClaimNavigationOffer) => {
    publishPostClaimNavigationOffer(offer);
  }, []);

  const openManual = useCallback(
    (offer: PostClaimNavigationOffer) => {
      applyOffer(offer, "manual");
    },
    [applyOffer],
  );

  const relaunchSelected = useCallback(() => {
    const current = session;
    if (!current?.selectedProviderId) {
      return false;
    }
    const links = buildExternalNavigationLinks(
      current.latitude,
      current.longitude,
    );
    if (!links) {
      return false;
    }
    const url =
      current.selectedProviderId === "waze"
        ? links.waze
        : current.selectedProviderId === "googleMaps"
          ? links.googleMaps
          : links.appleMaps;
    openExternalNavigationUrl(url);
    requestSeekerLiveLocationStart();
    return true;
  }, [session]);

  const closeChooser = useCallback(() => {
    logPostClaimNavigationDev("navigation chooser closed");
    setSession((current) =>
      current ? { ...current, open: false, source: "manual" } : null,
    );
  }, []);

  const selectProvider = useCallback((providerId: NavigationProviderId) => {
    logPostClaimNavigationDev("provider selected");
    setSession((current) =>
      current
        ? {
            ...current,
            open: false,
            source: "manual",
            providerSelected: true,
            selectedProviderId: providerId,
          }
        : null,
    );
  }, []);

  const value = useMemo(
    () => ({
      session,
      offerPostClaimNavigation: offerFromUi,
      openManual,
      relaunchSelected,
      closeChooser,
    }),
    [session, offerFromUi, openManual, relaunchSelected, closeChooser],
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
              title="Open in"
              description={getHandoffLocationDisclosure()}
              dismissLabel="Dismiss"
              onChoose={(url, providerId) => {
                openExternalNavigationUrl(url);
                requestSeekerLiveLocationStart();
                selectProvider(providerId);
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
