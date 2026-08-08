"use client";

import { useRef, useState } from "react";

import { NavigationProviderSheet } from "@/components/map/NavigationProviderSheet";
import { Button } from "@/components/ui/Button";
import {
  buildExternalNavigationLinks,
  isValidNavigationCoords,
  openExternalNavigationUrl,
} from "@/lib/map/navigation-urls";
import {
  clearPostClaimNavigationOffer,
  initialPostClaimNavigationOpen,
} from "@/lib/map/post-claim-navigation";

type ClaimNavigationActionsProps = {
  claimId: string;
  latitude: number;
  longitude: number;
  fullWidth?: boolean;
};

export function ClaimNavigationActions({
  claimId,
  latitude,
  longitude,
  fullWidth = false,
}: ClaimNavigationActionsProps) {
  const navigateButtonRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(() =>
    isValidNavigationCoords(latitude, longitude)
      ? initialPostClaimNavigationOpen(claimId)
      : false,
  );
  const [copyVariant, setCopyVariant] = useState<"post-claim" | "manual">(
    open ? "post-claim" : "manual",
  );

  const links = isValidNavigationCoords(latitude, longitude)
    ? buildExternalNavigationLinks(latitude, longitude)
    : null;

  if (!links) {
    return null;
  }

  function closeChooser() {
    clearPostClaimNavigationOffer(claimId);
    setCopyVariant("manual");
    setOpen(false);
  }

  function toggleChooser() {
    if (open) {
      closeChooser();
      return;
    }
    setCopyVariant("manual");
    setOpen(true);
  }

  return (
    <div className="relative">
      <Button
        ref={navigateButtonRef}
        type="button"
        variant="primary"
        className={fullWidth ? "w-full min-h-12" : "w-full min-h-12 sm:w-fit"}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggleChooser}
      >
        Open in
      </Button>

      <NavigationProviderSheet
        open={open}
        onClose={closeChooser}
        links={links}
        returnFocusRef={navigateButtonRef}
        title={copyVariant === "post-claim" ? "Spot claimed" : "Open in"}
        description={null}
        dismissLabel="Cancel"
        onChoose={(url) => {
          openExternalNavigationUrl(url);
          closeChooser();
        }}
      />
    </div>
  );
}
