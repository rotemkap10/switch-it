import {
  carImagesLoaderScriptUrl,
  getCarImagesPublicApiKey,
} from "@/lib/vehicle/carimages";

/**
 * Warm the CarImages loader + CDN connection on first document parse.
 * Does not execute the vendor script (it must run after the target img exists).
 */
export function CarImagesDocumentHints() {
  if (!getCarImagesPublicApiKey()) {
    return null;
  }

  const scriptUrl = carImagesLoaderScriptUrl();

  return (
    <>
      <link rel="preconnect" href="https://carimagesapi.com" />
      <link rel="preconnect" href="https://cdn.carimagesapi.com" />
      <link rel="preload" as="script" href={scriptUrl} />
    </>
  );
}
