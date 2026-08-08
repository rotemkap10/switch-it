"use client";

import { useRef, useState } from "react";

import { NavigationProviderSheet } from "@/components/map/NavigationProviderSheet";
import { Button } from "@/components/ui/Button";
import {
  buildExternalNavigationLinks,
  isValidNavigationCoords,
  openExternalNavigationUrl,
} from "@/lib/map/navigation-urls";

type ClaimNavigationActionsProps = {
  latitude: number;
  longitude: number;
  fullWidth?: boolean;
};

export function ClaimNavigationActions({
  latitude,
  longitude,
  fullWidth = false,
}: ClaimNavigationActionsProps) {
  const navigateButtonRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);

  const links = isValidNavigationCoords(latitude, longitude)
    ? buildExternalNavigationLinks(latitude, longitude)
    : null;

  if (!links) {
    return null;
  }

  return (
    <div className="relative">
      <Button
        ref={navigateButtonRef}
        type="button"
        variant="primary"
        className={fullWidth ? "w-full" : "w-full sm:w-fit"}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        Navigate
      </Button>

      <NavigationProviderSheet
        open={open}
        onClose={() => setOpen(false)}
        links={links}
        returnFocusRef={navigateButtonRef}
        onChoose={(url) => {
          openExternalNavigationUrl(url);
          setOpen(false);
        }}
      />
    </div>
  );
}
