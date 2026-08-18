import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  MAP_ATTRIBUTION_CONTROL_OPTIONS,
  collapseMapLibreAttribution,
  keepMapLibreAttributionInitiallyCollapsed,
} from "@/lib/map/maplibre-attribution";

function walkSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") {
      continue;
    }
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walkSourceFiles(full, acc);
      continue;
    }
    if (
      (extname(full) === ".ts" || extname(full) === ".tsx") &&
      !entry.includes(".test.")
    ) {
      acc.push(full);
    }
  }
  return acc;
}

describe("maplibre attribution", () => {
  it("uses native compact AttributionControl options", () => {
    expect(MAP_ATTRIBUTION_CONTROL_OPTIONS).toEqual({ compact: true });
  });

  it("collapses compact attribution without removing the control or its text", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <details class="maplibregl-ctrl maplibregl-ctrl-attrib maplibregl-compact maplibregl-compact-show">
        <summary class="maplibregl-ctrl-attrib-button"></summary>
        <div class="maplibregl-ctrl-attrib-inner">© MapTiler © OpenStreetMap contributors</div>
      </details>
    `;

    expect(collapseMapLibreAttribution(root)).toBe(true);

    const attrib = root.querySelector(".maplibregl-ctrl-attrib");
    expect(attrib).toBeInstanceOf(HTMLElement);
    expect(attrib).toHaveClass("maplibregl-compact");
    expect(attrib).not.toHaveClass("maplibregl-compact-show");
    expect(attrib).not.toHaveClass("maplibregl-attrib-empty");
    expect(root.querySelector(".maplibregl-ctrl-attrib-inner")).toHaveTextContent(
      "© MapTiler © OpenStreetMap contributors",
    );
    expect(root.querySelector(".maplibregl-ctrl-attrib-button")).not.toBeNull();
  });

  it("does not treat missing or empty attribution as collapsed success", () => {
    expect(collapseMapLibreAttribution(document.createElement("div"))).toBe(
      false,
    );

    const empty = document.createElement("div");
    empty.innerHTML = `<div class="maplibregl-ctrl-attrib maplibregl-attrib-empty"></div>`;
    expect(collapseMapLibreAttribution(empty)).toBe(false);
  });

  it("collapses after MapLibre first attaches compact-show, then leaves a later expand alone", () => {
    const root = document.createElement("div");
    const handlers = new Map<string, Array<() => void>>();

    const map = {
      getContainer: () => root,
      on: vi.fn((event: string, handler: () => void) => {
        const list = handlers.get(event) ?? [];
        list.push(handler);
        handlers.set(event, list);
      }),
      off: vi.fn((event: string, handler: () => void) => {
        handlers.set(
          event,
          (handlers.get(event) ?? []).filter((item) => item !== handler),
        );
      }),
    };

    const stop = keepMapLibreAttributionInitiallyCollapsed(map as never);
    expect(map.on).toHaveBeenCalledWith("styledata", expect.any(Function));

    root.innerHTML = `
      <details class="maplibregl-ctrl maplibregl-ctrl-attrib maplibregl-compact maplibregl-compact-show">
        <summary class="maplibregl-ctrl-attrib-button"></summary>
        <div class="maplibregl-ctrl-attrib-inner">© MapTiler</div>
      </details>
    `;

    for (const handler of handlers.get("styledata") ?? []) {
      handler();
    }

    expect(root.querySelector(".maplibregl-ctrl-attrib")).not.toHaveClass(
      "maplibregl-compact-show",
    );
    expect(handlers.get("styledata") ?? []).toHaveLength(0);

    root
      .querySelector(".maplibregl-ctrl-attrib")
      ?.classList.add("maplibregl-compact-show");
    for (const handler of handlers.get("styledata") ?? []) {
      handler();
    }
    expect(root.querySelector(".maplibregl-ctrl-attrib")).toHaveClass(
      "maplibregl-compact-show",
    );

    stop();
  });

  it("is configured once on BaseMap and no screen disables attribution", () => {
    const srcRoot = resolve(process.cwd(), "src");
    const files = walkSourceFiles(srcRoot);
    const mapConstructors = files.filter((file) => {
      const contents = readFileSync(file, "utf8");
      return contents.includes("new MapLibreMap(");
    });

    expect(mapConstructors).toEqual([
      resolve(process.cwd(), "src/components/map/BaseMap.tsx"),
    ]);

    const baseMap = readFileSync(mapConstructors[0]!, "utf8");
    expect(baseMap).toContain("MAP_ATTRIBUTION_CONTROL_OPTIONS");
    expect(baseMap).toContain("keepMapLibreAttributionInitiallyCollapsed");
    expect(baseMap).not.toContain("attributionControl: false");

    for (const file of files) {
      const contents = readFileSync(file, "utf8");
      expect(contents).not.toMatch(/attributionControl:\s*false/);
    }

    const css = readFileSync(
      resolve(process.cwd(), "src/app/globals.css"),
      "utf8",
    );
    expect(css).not.toMatch(
      /\.maplibregl-ctrl-attrib[^{]*\{[^}]*display:\s*none/,
    );
  });
});
