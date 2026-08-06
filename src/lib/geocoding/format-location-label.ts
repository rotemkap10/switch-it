import type { LocationLabelParts } from "@/lib/geocoding/types";
import { sanitizeLocationLabel } from "@/lib/geocoding/sanitize-location-label";

const MAX_FORMATTED_LENGTH = 120;

const COUNTRY_LIKE = /^(israel|state of israel)$/i;

function cleanPart(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function partsEqual(a: string, b: string): boolean {
  return a.localeCompare(b, undefined, { sensitivity: "accent" }) === 0;
}

function joinParts(segments: string[]): string | null {
  const unique: string[] = [];
  for (const segment of segments) {
    const cleaned = cleanPart(segment);
    if (!cleaned) {
      continue;
    }
    if (unique.some((existing) => partsEqual(existing, cleaned))) {
      continue;
    }
    unique.push(cleaned);
  }

  if (unique.length === 0) {
    return null;
  }

  const joined = unique.join(", ");
  if (joined.length > MAX_FORMATTED_LENGTH) {
    return joined.slice(0, MAX_FORMATTED_LENGTH).trim();
  }

  return sanitizeLocationLabel(joined);
}

/**
 * Builds the best concise parking label from neutral location parts.
 *
 * Priority:
 * 1. street + house number + city
 * 2. street + city
 * 3. named place + city
 * 4. neighborhood + city
 * 5. city
 * 6. null
 */
export function formatLocationLabel(parts: LocationLabelParts): string | null {
  const street = cleanPart(parts.street);
  const houseNumber = cleanPart(parts.houseNumber);
  const namedPlace = cleanPart(parts.namedPlace);
  const neighborhood = cleanPart(parts.neighborhood);
  const cityRaw = cleanPart(parts.city);
  const city =
    cityRaw && !COUNTRY_LIKE.test(cityRaw) ? cityRaw : null;

  if (street && city) {
    const streetLine = houseNumber ? `${street} ${houseNumber}` : street;
    if (!partsEqual(streetLine, city)) {
      const withNumber = joinParts([streetLine, city]);
      if (withNumber) {
        return withNumber;
      }
    }
    const streetOnly = joinParts([street, city]);
    if (streetOnly) {
      return streetOnly;
    }
  }

  if (namedPlace && city && !partsEqual(namedPlace, city)) {
    const named = joinParts([namedPlace, city]);
    if (named) {
      return named;
    }
  }

  if (neighborhood && city && !partsEqual(neighborhood, city)) {
    const area = joinParts([neighborhood, city]);
    if (area) {
      return area;
    }
  }

  if (city) {
    return sanitizeLocationLabel(city);
  }

  return null;
}
