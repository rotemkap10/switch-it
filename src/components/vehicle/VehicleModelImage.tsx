"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { CarImagesLoader } from "@/components/vehicle/CarImagesLoader";
import {
  CARIMAGES_FORMAT,
  CARIMAGES_LOADER_ERROR_EVENT,
  CARIMAGES_TYPE,
  CARIMAGES_VIEW,
  carImagesSrcHostPath,
  carImagesWidthForSize,
  getCarImagesPublicApiKey,
  isCarImagesLoaderResolvedSrc,
  logCarImages,
  normalizeCarImagesYear,
  type VehicleImageSize,
} from "@/lib/vehicle/carimages";
import {
  carImagesOutcomeKey,
  forgetCarImagesOutcome,
  peekCarImagesOutcome,
  rememberCarImagesOutcome,
} from "@/lib/vehicle/carimages-outcome-cache";

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

function currentImgSrc(img: HTMLImageElement): string {
  return img.currentSrc || img.getAttribute("src") || "";
}

function isDecoded(img: HTMLImageElement): boolean {
  return img.complete && img.naturalWidth > 0;
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
      key={`${makeValue}:${modelValue}:${yearValue ?? ""}:${size}`}
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
  const outcomeKey = carImagesOutcomeKey(make, model, year, size);
  const imgRef = useRef<HTMLImageElement>(null);
  const lastSrcRef = useRef<string>("");
  const [status, setStatus] = useState<ModelImageStatus>(() => {
    const cached = peekCarImagesOutcome(outcomeKey);
    return cached?.status ?? "pending";
  });
  const prioritize = size === "handoff" || size === "hero";

  useLayoutEffect(() => {
    const img = imgRef.current;
    if (!img) {
      return;
    }

    const cached = peekCarImagesOutcome(outcomeKey);
    if (cached?.status === "ready" && !img.getAttribute("src")) {
      img.src = cached.src;
      lastSrcRef.current = cached.src;
    }

    logCarImages(
      `element mounted make=${make} model=${model} year=${year ?? ""}`,
    );
    logCarImages(`src initial host/path=${carImagesSrcHostPath(currentImgSrc(img))}`);

    const markFallback = (reason: string) => {
      logCarImages(`fallback reason=${reason}`);
      rememberCarImagesOutcome(outcomeKey, { status: "fallback" });
      setStatus("fallback");
    };

    const markReady = (src: string) => {
      rememberCarImagesOutcome(outcomeKey, { status: "ready", src });
      setStatus("ready");
    };

    const syncFromImage = (fromLoadEvent = false) => {
      const loaded = img.getAttribute("data-ci-loaded");
      const src = currentImgSrc(img);
      if (src && src !== lastSrcRef.current) {
        lastSrcRef.current = src;
        logCarImages(`src changed host/path=${carImagesSrcHostPath(src)}`);
      }

      if (loaded === "error") {
        markFallback("loader-error");
        return;
      }

      const resolved =
        Boolean(src) &&
        (loaded === "true" || isCarImagesLoaderResolvedSrc(src));
      if (resolved && (fromLoadEvent || isDecoded(img))) {
        logCarImages(`resolved url=${carImagesSrcHostPath(src)}`);
        markReady(src);
        return;
      }

      if (loaded === "true" && !src) {
        markFallback("loaded-without-src");
      }
    };

    const onLoad = () => {
      logCarImages(
        `image load success host/path=${carImagesSrcHostPath(currentImgSrc(img))}`,
      );
      syncFromImage(true);
    };

    const onError = () => {
      logCarImages(
        `image load error host/path=${carImagesSrcHostPath(currentImgSrc(img))}`,
      );
      const loaded = img.getAttribute("data-ci-loaded");
      if (loaded === "error" || loaded === "true") {
        markFallback("image-error");
        return;
      }
      // Cached/expired URL failed — wait for the loader to assign a fresh one.
      forgetCarImagesOutcome(outcomeKey);
      lastSrcRef.current = "";
      setStatus("pending");
    };

    const onLoaderScriptError = () => {
      if (peekCarImagesOutcome(outcomeKey)?.status === "ready") {
        return;
      }
      markFallback("loader-script-error");
    };

    img.addEventListener("load", onLoad);
    img.addEventListener("error", onError);
    window.addEventListener(CARIMAGES_LOADER_ERROR_EVENT, onLoaderScriptError);
    const observer = new MutationObserver(() => syncFromImage(false));
    observer.observe(img, {
      attributes: true,
      attributeFilter: ["data-ci-loaded", "src"],
    });

    if (isDecoded(img) && isCarImagesLoaderResolvedSrc(currentImgSrc(img))) {
      markReady(currentImgSrc(img));
    } else {
      syncFromImage(false);
    }

    return () => {
      img.removeEventListener("load", onLoad);
      img.removeEventListener("error", onError);
      window.removeEventListener(
        CARIMAGES_LOADER_ERROR_EVENT,
        onLoaderScriptError,
      );
      observer.disconnect();
    };
  }, [make, model, year, outcomeKey]);

  const showModel = status === "ready";
  const showFallback = status === "fallback";

  return (
    <div
      className={["vehicle-model-image", className].filter(Boolean).join(" ")}
      data-testid="vehicle-model-image-root"
      aria-busy={status === "pending" || undefined}
    >
      <CarImagesLoader priority={prioritize} />
      {status === "pending" ? (
        <span className="sr-only">Loading vehicle image</span>
      ) : null}
      <div hidden={!showFallback}>{children}</div>
      <div
        className={[
          "vehicle-photo-frame",
          `vehicle-photo-frame--${size}`,
          "vehicle-photo-frame--model",
          className,
          status === "fallback" ? "vehicle-model-image__pending" : "",
          status === "pending" ? "vehicle-model-image__pending--slot" : "",
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
          fetchPriority={prioritize ? "high" : "auto"}
        />
      </div>
    </div>
  );
}
