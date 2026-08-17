import {
  VEHICLE_CATALOG,
  type VehicleCatalogMake,
  type VehicleCatalogModel,
} from "@/lib/vehicle/catalog-data";
import { isVehicleType, type VehicleType } from "@/lib/vehicle/types";

export { VEHICLE_CATALOG, type VehicleCatalogMake, type VehicleCatalogModel };

/** Lowercase alphanumeric key: ignores case, spaces, hyphens, and punctuation. */
export function normalizeVehicleKey(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function vehicleCatalogMakeCount(): number {
  return VEHICLE_CATALOG.length;
}

export function vehicleCatalogModelCount(): number {
  return VEHICLE_CATALOG.reduce((sum, make) => sum + make.models.length, 0);
}

/**
 * Confident make match only: exact normalized name or alias.
 * Does not fuzzy-map typos such as "toyta".
 */
export function matchMake(value: string): VehicleCatalogMake | null {
  const key = normalizeVehicleKey(value);
  if (!key) {
    return null;
  }

  for (const make of VEHICLE_CATALOG) {
    if (normalizeVehicleKey(make.name) === key) {
      return make;
    }
    if (make.aliases?.some((alias) => normalizeVehicleKey(alias) === key)) {
      return make;
    }
  }

  return null;
}

/**
 * Confident model match only: exact normalized model name under the make.
 * Does not map "corola" to Corolla.
 */
export function matchModel(
  makeValue: string,
  modelValue: string,
): string | null {
  return findCatalogModel(makeValue, modelValue)?.name ?? null;
}

function findCatalogModel(
  makeValue: string,
  modelValue: string,
): VehicleCatalogModel | null {
  const make = matchMake(makeValue);
  if (!make) {
    return null;
  }
  const key = normalizeVehicleKey(modelValue);
  if (!key) {
    return null;
  }
  return make.models.find((model) => normalizeVehicleKey(model.name) === key) ?? null;
}

/**
 * Internal silhouette class for generic illustrations.
 * Catalog match wins; otherwise a valid stored `vehicle_type`; otherwise `other`.
 */
export function getVehicleClass(
  make: string | null | undefined,
  model: string | null | undefined,
  legacyType?: string | null,
): VehicleType {
  const catalogModel = findCatalogModel(make ?? "", model ?? "");
  if (catalogModel) {
    return catalogModel.class;
  }
  if (legacyType && isVehicleType(legacyType)) {
    return legacyType;
  }
  return "other";
}

export function vehicleCatalogClassCount(): number {
  return VEHICLE_CATALOG.reduce(
    (sum, make) => sum + make.models.filter((model) => Boolean(model.class)).length,
    0,
  );
}

export const QUERY_SCORE_EXACT = 4;
export const QUERY_SCORE_PREFIX = 3;
export const QUERY_SCORE_SUBSTRING = 2;
export const QUERY_SCORE_FUZZY = 1;

/**
 * Damerau–Levenshtein distance with a tight bound. Returns a large number when
 * the strings are too far apart for a conservative suggestion.
 */
function boundedEditDistance(a: string, b: string, maxDistance: number): number {
  if (Math.abs(a.length - b.length) > maxDistance) {
    return maxDistance + 1;
  }

  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp: number[][] = Array.from({ length: rows }, () =>
    Array<number>(cols).fill(0),
  );

  for (let i = 0; i <= a.length; i += 1) {
    dp[i][0] = i;
  }
  for (let j = 0; j <= b.length; j += 1) {
    dp[0][j] = j;
  }

  for (let i = 1; i <= a.length; i += 1) {
    let rowMin = dp[i][0];
    for (let j = 1; j <= b.length; j += 1) {
      const substitution = a[i - 1] === b[j - 1] ? 0 : 1;
      let distance = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + substitution,
      );
      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        distance = Math.min(distance, dp[i - 2][j - 2] + 1);
      }
      dp[i][j] = distance;
      rowMin = Math.min(rowMin, distance);
    }
    if (rowMin > maxDistance) {
      return maxDistance + 1;
    }
  }

  return dp[a.length][b.length];
}

/**
 * Suggestion-only typo score. Never used by canonicalize / matchMake / matchModel.
 * Requires a 4+ character query, same first letter, and a small edit distance.
 */
function fuzzySuggestionScore(
  normalizedCandidate: string,
  normalizedQuery: string,
): number {
  if (normalizedQuery.length < 4 || normalizedCandidate.length < 4) {
    return 0;
  }
  if (normalizedCandidate[0] !== normalizedQuery[0]) {
    return 0;
  }

  const maxDistance = normalizedQuery.length >= 6 ? 2 : 1;
  const distance = boundedEditDistance(
    normalizedQuery,
    normalizedCandidate,
    maxDistance,
  );
  if (distance <= 0 || distance > maxDistance) {
    return 0;
  }

  const longest = Math.max(normalizedQuery.length, normalizedCandidate.length);
  if (distance / longest > 0.34) {
    return 0;
  }

  return QUERY_SCORE_FUZZY;
}

/**
 * Suggestion ranking: 4 exact, 3 prefix, 2 substring (query length >= 3),
 * 1 conservative typo. 0 = no match. Fuzzy scores are for lists only.
 */
export function queryMatchScore(candidate: string, query: string): number {
  const normalizedQuery = normalizeVehicleKey(query);
  const normalizedCandidate = normalizeVehicleKey(candidate);
  if (!normalizedQuery || !normalizedCandidate) {
    return 0;
  }
  if (normalizedCandidate === normalizedQuery) {
    return QUERY_SCORE_EXACT;
  }
  if (normalizedCandidate.startsWith(normalizedQuery)) {
    return QUERY_SCORE_PREFIX;
  }
  if (normalizedQuery.length >= 3 && normalizedCandidate.includes(normalizedQuery)) {
    return QUERY_SCORE_SUBSTRING;
  }
  return fuzzySuggestionScore(normalizedCandidate, normalizedQuery);
}

function bestMakeScore(make: VehicleCatalogMake, query: string): number {
  let best = queryMatchScore(make.name, query);
  for (const alias of make.aliases ?? []) {
    best = Math.max(best, queryMatchScore(alias, query));
  }
  return best;
}

export function searchMakes(query: string): VehicleCatalogMake[] {
  if (!query.trim()) {
    return [...VEHICLE_CATALOG];
  }

  return VEHICLE_CATALOG.map((make) => ({
    make,
    score: bestMakeScore(make, query),
  }))
    .filter((row) => row.score > 0)
    .sort(
      (a, b) => b.score - a.score || a.make.name.localeCompare(b.make.name),
    )
    .map((row) => row.make);
}

export function searchModels(makeValue: string, query: string): string[] {
  const make = matchMake(makeValue);
  if (!make) {
    return [];
  }
  if (!query.trim()) {
    return make.models.map((model) => model.name);
  }

  return make.models
    .map((model) => ({
      model: model.name,
      score: queryMatchScore(model.name, query),
    }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.model.localeCompare(b.model))
    .map((row) => row.model);
}

export function canonicalizeMake(value: string): string {
  const trimmed = value.trim();
  return matchMake(trimmed)?.name ?? trimmed;
}

export function canonicalizeModel(makeValue: string, modelValue: string): string {
  const trimmed = modelValue.trim();
  return matchModel(makeValue, trimmed) ?? trimmed;
}

export function resolveCanonicalVehicleIdentity(
  make: string | null | undefined,
  model: string | null | undefined,
): { make: string; model: string } {
  const rawMake = make?.trim() ?? "";
  const rawModel = model?.trim() ?? "";
  const canonicalMake = canonicalizeMake(rawMake);
  return {
    make: canonicalMake,
    model: canonicalizeModel(canonicalMake, rawModel),
  };
}

function titleCaseWords(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

/** Display label: canonical catalog name when confident, otherwise title-case. */
export function displayMakeName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  return matchMake(trimmed)?.name ?? titleCaseWords(trimmed);
}

export function displayModelName(makeValue: string, modelValue: string): string {
  const trimmed = modelValue.trim();
  if (!trimmed) {
    return "";
  }
  return matchModel(makeValue, trimmed) ?? titleCaseWords(trimmed);
}

export function formatCanonicalMakeModelYear(
  make: string,
  model: string,
  year?: number | null,
): string {
  const name = `${displayMakeName(make)} ${displayModelName(make, model)}`.trim();
  return year != null ? `${name} · ${year}` : name;
}

/**
 * After a manufacturer change, keep the model only when it is valid for the
 * new make. Otherwise return empty so the form cannot keep a Toyota model
 * under Hyundai.
 */
export function modelAfterMakeChange(
  nextMake: string,
  currentModel: string,
): string {
  if (!nextMake.trim() || !currentModel.trim()) {
    return "";
  }
  return matchModel(nextMake, currentModel) ?? "";
}
