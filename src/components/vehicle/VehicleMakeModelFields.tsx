"use client";

import { useEffect, useMemo, useState } from "react";

import { Combobox } from "@/components/ui/Combobox";
import { Input } from "@/components/ui/Input";
import {
  canonicalizeMake,
  canonicalizeModel,
  matchMake,
  matchModel,
  modelAfterMakeChange,
  searchMakes,
  searchModels,
} from "@/lib/vehicle/catalog";

type VehicleMakeModelFieldsProps = {
  make: string;
  model: string;
  onChange: (next: { make: string; model: string }) => void;
  disabled?: boolean;
  makeError?: string;
  modelError?: string;
};

type EntryMode = "catalog" | "other";

function initialMakeMode(make: string): EntryMode {
  if (!make.trim()) {
    return "catalog";
  }
  return matchMake(make) ? "catalog" : "other";
}

function initialModelMode(make: string, model: string): EntryMode {
  if (!model.trim()) {
    return "catalog";
  }
  if (!matchMake(make)) {
    return "other";
  }
  return matchModel(make, model) ? "catalog" : "other";
}

export function VehicleMakeModelFields({
  make,
  model,
  onChange,
  disabled = false,
  makeError,
  modelError,
}: VehicleMakeModelFieldsProps) {
  const [makeMode, setMakeMode] = useState<EntryMode>(() =>
    initialMakeMode(make),
  );
  const [modelMode, setModelMode] = useState<EntryMode>(() =>
    initialModelMode(make, model),
  );

  const makeOptions = useMemo(
    () =>
      searchMakes("").map((entry) => ({
        value: entry.name,
        label: entry.name,
        keywords: entry.aliases ? [...entry.aliases] : undefined,
      })),
    [],
  );
  const modelOptions = useMemo(
    () =>
      searchModels(make, "").map((name) => ({
        value: name,
        label: name,
      })),
    [make],
  );

  const catalogMake = matchMake(make);
  const modelEnabled = make.trim().length > 0 && !disabled;
  const showModelCombobox =
    makeMode === "catalog" && modelMode === "catalog";

  useEffect(() => {
    const nextMake = canonicalizeMake(make);
    const nextModel = canonicalizeModel(nextMake, model);
    if (nextMake !== make || nextModel !== model) {
      onChange({ make: nextMake, model: nextModel });
    }
    // Align existing free-text values once after mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectCatalogMake(nextMake: string) {
    const canonicalMake = canonicalizeMake(nextMake);
    setMakeMode("catalog");
    if (canonicalMake === canonicalizeMake(make) && canonicalMake !== "") {
      if (matchModel(canonicalMake, model)) {
        setModelMode("catalog");
      }
      if (make !== canonicalMake) {
        onChange({ make: canonicalMake, model });
      }
      return;
    }
    const nextModel = modelAfterMakeChange(canonicalMake, model);
    setModelMode("catalog");
    onChange({ make: canonicalMake, model: nextModel });
  }

  function selectCatalogModel(nextModel: string) {
    setModelMode("catalog");
    onChange({ make, model: canonicalizeModel(make, nextModel) });
  }

  return (
    <>
      <input type="hidden" name="vehicle_make" value={make} />
      <input type="hidden" name="vehicle_model" value={model} />

      <div className="flex flex-col gap-1.5">
        {makeMode === "catalog" ? (
          <Combobox
            id="vehicle_make"
            label="Manufacturer"
            value={catalogMake?.name ?? ""}
            onChange={selectCatalogMake}
            options={makeOptions}
            disabled={disabled}
            placeholder="Select manufacturer"
            emptyText="No matching manufacturers"
            error={makeError}
          />
        ) : (
          <Input
            id="vehicle_make"
            label="Manufacturer"
            type="text"
            autoComplete="off"
            autoCapitalize="words"
            maxLength={40}
            value={make}
            onChange={(event) => onChange({ make: event.target.value, model })}
            disabled={disabled}
            placeholder="Enter manufacturer"
            error={makeError}
          />
        )}
        {makeMode === "catalog" ? (
          <button
            type="button"
            className="self-start text-sm text-muted underline-offset-2 hover:text-foreground hover:underline disabled:opacity-60"
            onClick={() => {
              setMakeMode("other");
              setModelMode("other");
              onChange({ make: "", model: "" });
            }}
            disabled={disabled}
            data-testid="vehicle-make-not-listed"
          >
            Can&apos;t find your manufacturer?
          </button>
        ) : (
          <button
            type="button"
            className="self-start text-sm text-muted underline-offset-2 hover:text-foreground hover:underline disabled:opacity-60"
            onClick={() => selectCatalogMake(matchMake(make)?.name ?? "")}
            disabled={disabled}
            data-testid="vehicle-make-use-catalog"
          >
            Choose manufacturer from list
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        {showModelCombobox ? (
          <Combobox
            id="vehicle_model"
            label="Model"
            value={matchModel(make, model) ?? ""}
            onChange={selectCatalogModel}
            options={modelOptions}
            disabled={!modelEnabled}
            placeholder={
              make.trim() ? "Select model" : "Select manufacturer first"
            }
            emptyText="No matching models"
            error={modelError}
          />
        ) : (
          <Input
            id="vehicle_model"
            label="Model"
            type="text"
            autoComplete="off"
            autoCapitalize="words"
            maxLength={40}
            value={model}
            onChange={(event) => onChange({ make, model: event.target.value })}
            disabled={!modelEnabled}
            placeholder={
              make.trim() ? "Enter model" : "Select manufacturer first"
            }
            error={modelError}
          />
        )}
        {makeMode === "catalog" && catalogMake && modelMode === "catalog" ? (
          <button
            type="button"
            className="self-start text-sm text-muted underline-offset-2 hover:text-foreground hover:underline disabled:opacity-60"
            onClick={() => setModelMode("other")}
            disabled={!modelEnabled}
            data-testid="vehicle-model-not-listed"
          >
            Can&apos;t find your model?
          </button>
        ) : null}
        {makeMode === "catalog" && catalogMake && modelMode === "other" ? (
          <button
            type="button"
            className="self-start text-sm text-muted underline-offset-2 hover:text-foreground hover:underline disabled:opacity-60"
            onClick={() => {
              setModelMode("catalog");
              onChange({
                make,
                model: matchModel(make, model) ?? "",
              });
            }}
            disabled={!modelEnabled}
            data-testid="vehicle-model-use-catalog"
          >
            Choose model from list
          </button>
        ) : null}
        {makeMode === "other" || modelMode === "other" ? (
          <p className="text-xs text-muted" data-testid="vehicle-other-hint">
            We&apos;ll save the name you entered. A stock photo may not be
            available for uncommon vehicles.
          </p>
        ) : null}
      </div>
    </>
  );
}
