"use client";

import { useState } from "react";

import { VehicleIllustration } from "@/components/vehicle/VehicleIllustration";
import { VehicleModelImage } from "@/components/vehicle/VehicleModelImage";
import { CarImagesLoader } from "@/components/vehicle/CarImagesLoader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { getCarImagesPublicApiKey } from "@/lib/vehicle/carimages";
import { CARIMAGES_DEV_TEST_VEHICLES } from "@/lib/vehicle/carimages-test-vehicles";

type CustomVehicle = {
  make: string;
  model: string;
  year: string;
};

export function CarImagesDevGrid() {
  const hasPublicKey = Boolean(getCarImagesPublicApiKey());
  const [custom, setCustom] = useState<CustomVehicle>({
    make: "Hyundai",
    model: "Tucson",
    year: "2025",
  });
  const [preview, setPreview] = useState<CustomVehicle>(custom);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          Temporary developer helper
        </p>
        <h1 className="text-2xl font-semibold text-foreground">CarImages PoC</h1>
        <p className="text-sm text-muted">
          Catalog WebP <code>front34</code> images via the official JS loader.
          Unknown matches keep the generic Switch It illustration. This page is
          not linked in navigation.
        </p>
        <p className="text-sm text-foreground">
          Public loader key: {hasPublicKey ? "configured" : "missing"}
        </p>
      </header>

      <section
        className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-4"
        data-testid="carimages-raw-official-example"
      >
        <CarImagesLoader />
        <h2 className="text-base font-semibold text-foreground">
          Raw official loader example
        </h2>
        <p className="text-sm text-muted">
          Native <code>&lt;img&gt;</code> copied from CarImages docs, outside
          VehicleModelImage. If this car appears and the cards below stay as
          illustrations, the bug is in our wrapper.
        </p>
        {/* Native img required by the official CarImages loader. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          data-ci-make="BMW"
          data-ci-model="3 Series"
          data-ci-year="2022"
          alt="BMW 3 Series"
          className="max-h-48 w-auto bg-surface"
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {CARIMAGES_DEV_TEST_VEHICLES.map((vehicle) => (
          <VehiclePreviewCard
            key={`${vehicle.make}-${vehicle.model}-${vehicle.year}`}
            make={vehicle.make}
            model={vehicle.model}
            year={vehicle.year}
          />
        ))}
      </section>

      <section className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-4">
        <h2 className="text-base font-semibold text-foreground">Custom combo</h2>
        <Input
          id="dev-carimages-make"
          label="Make"
          value={custom.make}
          onChange={(event) =>
            setCustom((current) => ({ ...current, make: event.target.value }))
          }
        />
        <Input
          id="dev-carimages-model"
          label="Model"
          value={custom.model}
          onChange={(event) =>
            setCustom((current) => ({ ...current, model: event.target.value }))
          }
        />
        <Input
          id="dev-carimages-year"
          label="Year"
          inputMode="numeric"
          value={custom.year}
          onChange={(event) =>
            setCustom((current) => ({ ...current, year: event.target.value }))
          }
        />
        <Button
          type="button"
          onClick={() => setPreview(custom)}
          className="self-start"
        >
          Preview
        </Button>
        <VehiclePreviewCard
          make={preview.make}
          model={preview.model}
          year={preview.year}
        />
      </section>
    </div>
  );
}

function VehiclePreviewCard({
  make,
  model,
  year,
}: {
  make: string;
  model: string;
  year: string | number;
}) {
  const label = `${make} ${model} ${year}`.trim();

  return (
    <article
      className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-border bg-surface p-3"
      data-testid="carimages-dev-card"
    >
      <VehicleModelImage make={make} model={model} year={year} alt={label} size="hero">
        <VehicleIllustration
          vehicleType="sedan"
          vehicleColor="silver"
          size="hero"
          animate={false}
          label={`${label} fallback`}
        />
      </VehicleModelImage>
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="font-mono text-xs text-muted" data-testid="carimages-dev-loader-attrs">
        data-ci-make={make} data-ci-model={model} data-ci-year={year}
      </p>
    </article>
  );
}
