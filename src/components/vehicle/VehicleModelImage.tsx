"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { CarImagesLoader } from "@/components/vehicle/CarImagesLoader";
import {
  CARIMAGES_FORMAT,
  CARIMAGES_TYPE,
  CARIMAGES_VIEW,
  carImagesWidthForSize,
  getCarImagesPublicApiKey,
  isUsableCarImagesUrl,
  normalizeCarImagesYear,
  type VehicleImageSize,
} from "@/lib/vehicle/carimages";

type VehicleModelImageProps = {
  make?: string | null;
  model?: string | null;
  year?: string | number | null;
  alt: string;
  className?: string;
  size?: VehicleImageSize;
  children: ReactNode;
};

type ModelImageStatus = "pending" | "ready" | "fallback";

function trimmed(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

export function VehicleModelImage({
  make,
  model,
  year,
  alt,
  className = "",
  size = "default",
  children,
}: VehicleModelImageProps) {
  const makeValue = trimmed(make);
  const modelValue = trimmed(model);
  const yearValue = normalizeCarImagesYear(year);
  const canRequest =
    Boolean(getCarImagesPublicApiKey()) &&
    makeValue.length > 0 &&
    modelValue.length > 0;

  if (!canRequest) {
    return children;
  }

  return (
    <VehicleModelImageRequest
      key={`${makeValue}:${modelValue}:${yearValue ?? ""}`}
      make={makeValue}
      model={modelValue}
      year={yearValue}
      alt={alt}
      className={className}
      size={size}
    >
      {children}
    </VehicleModelImageRequest>
  );
}

function VehicleModelImageRequest({
  make,
  model,
  year,
  alt,
  className,
  size,
  children,
}: {
  make: string;
  model: string;
  year: string | undefined;
  alt: string;
  className: string;
  size: VehicleImageSize;
  children: ReactNode;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [status, setStatus] = useState<ModelImageStatus>("pending");

  useEffect(() => {
    const img = imgRef.current;
    if (!img) {
      return;
    }

    const syncFromImage = () => {
      const loaded = img.getAttribute("data-ci-loaded");
      if (loaded === "error") {
        setStatus("fallback");
        return;
      }

      const src = img.currentSrc || img.getAttribute("src") || "";
      if (isUsableCarImagesUrl(src)) {
        setStatus("ready");
        return;
      }

      if (loaded === "true") {
        setStatus("fallback");
      }
    };

    const onError = () => setStatus("fallback");

    img.addEventListener("load", syncFromImage);
    img.addEventListener("error", onError);
    const observer = new MutationObserver(syncFromImage);
    observer.observe(img, {
      attributes: true,
      attributeFilter: ["data-ci-loaded", "src"],
    });

    return () => {
      img.removeEventListener("load", syncFromImage);
      img.removeEventListener("error", onError);
      observer.disconnect();
    };
  }, []);

  const showModel = status === "ready";

  return (
    <div
      className={["vehicle-model-image", className].filter(Boolean).join(" ")}
      data-testid="vehicle-model-image-root"
    >
      <CarImagesLoader />
      <div hidden={showModel}>{children}</div>
      <div
        className={[
          "vehicle-photo-frame",
          `vehicle-photo-frame--${size}`,
          "vehicle-photo-frame--model",
          className,
          showModel ? "" : "vehicle-model-image__pending",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-hidden={!showModel}
        data-testid="vehicle-model-image-frame"
        data-size={size}
        data-status={status}
      >
        {/* Native img required by the CarImages JS loader (data-ci-* attrs). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          alt={showModel ? alt : ""}
          className="vehicle-photo-frame__image vehicle-photo-frame__image--model"
          data-testid="vehicle-model-image"
          data-ci-make={make}
          data-ci-model={model}
          {...(year ? { "data-ci-year": year } : {})}
          data-ci-view={CARIMAGES_VIEW}
          data-ci-format={CARIMAGES_FORMAT}
          data-ci-type={CARIMAGES_TYPE}
          data-ci-width={carImagesWidthForSize(size)}
        />
      </div>
    </div>
  );
}
