import { describe, expect, it } from "vitest";

import {
  QUERY_SCORE_EXACT,
  QUERY_SCORE_FUZZY,
  canonicalizeMake,
  canonicalizeModel,
  matchMake,
  matchModel,
  modelAfterMakeChange,
  queryMatchScore,
  resolveCanonicalVehicleIdentity,
  searchMakes,
  searchModels,
  vehicleCatalogMakeCount,
  vehicleCatalogModelCount,
} from "@/lib/vehicle/catalog";
import { formatMakeModelYear } from "@/lib/vehicle/years";

describe("vehicle catalog", () => {
  it("includes the Israel-common manufacturer set as a local catalog", () => {
    expect(vehicleCatalogMakeCount()).toBeGreaterThanOrEqual(30);
    expect(vehicleCatalogModelCount()).toBeGreaterThanOrEqual(200);
    expect(searchMakes("").map((make) => make.name)).toEqual(
      expect.arrayContaining([
        "Toyota",
        "Hyundai",
        "Kia",
        "Skoda",
        "Mazda",
        "Seat",
        "Volkswagen",
        "Suzuki",
        "Mitsubishi",
        "Nissan",
        "Honda",
        "Subaru",
        "Ford",
        "Renault",
        "Peugeot",
        "Citroen",
        "Chevrolet",
        "Opel",
        "Fiat",
        "MG",
        "BYD",
        "Geely",
        "Tesla",
        "Volvo",
        "BMW",
        "Mercedes-Benz",
        "Audi",
        "Lexus",
        "Dacia",
        "Cupra",
      ]),
    );
  });

  it("filters manufacturers with case-insensitive prefix and alias search", () => {
    expect(searchMakes("Toy").map((make) => make.name)).toContain("Toyota");
    expect(searchMakes("merc").map((make) => make.name)).toContain(
      "Mercedes-Benz",
    );
    expect(searchMakes("vw").map((make) => make.name)).toEqual(["Volkswagen"]);
  });

  it("stores canonical manufacturer casing from confident matches", () => {
    expect(matchMake("toyota")?.name).toBe("Toyota");
    expect(matchMake("TOYOTA")?.name).toBe("Toyota");
    expect(matchMake(" Toyota ")?.name).toBe("Toyota");
    expect(canonicalizeMake("toyota")).toBe("Toyota");
  });

  it("lists Toyota models including Corolla and keeps Hyundai separate", () => {
    expect(searchModels("Toyota", "")).toContain("Corolla");
    expect(searchModels("Toyota", "cor")).toContain("Corolla");
    expect(searchModels("Hyundai", "")).not.toContain("Corolla");
    expect(searchModels("Hyundai", "cor")).not.toContain("Corolla");
    expect(searchModels("Hyundai", "")).toContain("Tucson");
  });

  it("does not fuzzy-map typos to a different model", () => {
    expect(matchModel("Toyota", "corola")).toBeNull();
    expect(canonicalizeModel("Toyota", "corola")).toBe("corola");
  });

  it("suggests conservative typos without treating them as a confident match", () => {
    expect(searchModels("Toyota", "corola")).toContain("Corolla");
    expect(queryMatchScore("Corolla", "corola")).toBe(QUERY_SCORE_FUZZY);
    expect(queryMatchScore("Corolla", "Corolla")).toBe(QUERY_SCORE_EXACT);
    expect(searchModels("Toyota", "Corolla")[0]).toBe("Corolla");
    expect(searchModels("Hyundai", "tucsn")).toContain("Tucson");
  });

  it("does not suggest a model typo under the wrong manufacturer", () => {
    expect(searchModels("Hyundai", "corola")).not.toContain("Corolla");
    expect(searchModels("Toyota", "tucsn")).not.toContain("Tucson");
  });

  it("does not create aggressive false matches from unrelated strings", () => {
    expect(searchModels("Toyota", "zzzzzz")).toEqual([]);
    expect(searchModels("Toyota", "banana")).not.toContain("Corolla");
    expect(searchModels("Toyota", "qqqq")).toEqual([]);
    expect(searchModels("Hyundai", "camry")).not.toContain("Tucson");
    expect(queryMatchScore("Corolla", "ab")).toBe(0);
  });

  it("clears incompatible models when the manufacturer changes", () => {
    expect(modelAfterMakeChange("Hyundai", "Corolla")).toBe("");
    expect(modelAfterMakeChange("Toyota", "Corolla")).toBe("Corolla");
    expect(modelAfterMakeChange("Hyundai", "Tucson")).toBe("Tucson");
  });

  it("preserves unknown existing values when there is no confident match", () => {
    expect(matchMake("Koenigsegg")).toBeNull();
    expect(canonicalizeMake("Koenigsegg")).toBe("Koenigsegg");
    expect(
      resolveCanonicalVehicleIdentity("toyota", "corola"),
    ).toEqual({
      make: "Toyota",
      model: "corola",
    });
  });

  it("formats display with canonical names when the match is confident", () => {
    expect(formatMakeModelYear("toyota", "corolla", 2024)).toBe(
      "Toyota Corolla · 2024",
    );
    expect(formatMakeModelYear("toyota", "corola", 2024)).toBe(
      "Toyota Corola · 2024",
    );
  });
});
