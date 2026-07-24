/**
 * Stages 4–6: overlay merge → validate → emit static artifacts.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import MiniSearch from "minisearch";
import type { Claim, Manifest, Person, PersonId, VerseRef } from "@genealogy/schema";
import type { ChronologyLayer } from "@genealogy/schema";
import type { TheoRawExtras } from "./ingest.js";
import type { TheoPeopleGroup } from "./theographic.js";
import { PIPELINE_CONFIG } from "./config.js";
import { loadOverlay, applyOverlay } from "./overlay.js";
import { loadLineageSpecs, buildLineages } from "./lineages.js";
import { validate } from "./validate.js";
import { readVendored, THEOGRAPHIC_COMMIT } from "./vendor.js";

export interface Stage456Input {
  persons: Map<PersonId, Person>;
  claims: Claim[];
  included: Set<PersonId>;
  raw: Map<PersonId, TheoRawExtras>;
  fullRefs: Map<PersonId, VerseRef[]>;
  validateOnly: boolean;
}

/** MiniSearch options shared verbatim with the app's loader. */
export const SEARCH_OPTIONS = {
  fields: ["primaryName", "variantNames", "disambiguator"],
  storeFields: [],
  idField: "id",
} as const;

export async function runOverlayValidateEmit(input: Stage456Input): Promise<void> {
  const cfg = PIPELINE_CONFIG;

  // Restrict to filtered people before overlaying.
  const filteredPersons = new Map<PersonId, Person>();
  for (const id of input.included) {
    const p = input.persons.get(id);
    if (p) filteredPersons.set(id, p);
  }

  // Populate groups from peopleGroups.json.
  const theoGroups = readVendored("peopleGroups.json") as TheoPeopleGroup[];
  const groupNames = new Map<string, string>();
  for (const g of theoGroups) {
    if (g.fields.groupName) groupNames.set(g.id, g.fields.groupName);
  }
  for (const [id, person] of filteredPersons) {
    const extras = input.raw.get(id);
    if (!extras) continue;
    const names = extras.memberOfRecIds
      .map((r) => groupNames.get(r))
      .filter((n): n is string => n !== undefined);
    if (names.length > 0) person.groups = [...new Set([...person.groups, ...names])];
  }

  // Stage 4 — overlay
  const overlay = loadOverlay();
  const merged = applyOverlay(filteredPersons, input.claims, overlay);
  console.log(
    `overlay: ${overlay.people.length} person entries (${merged.addedPeople.size} new), ` +
      `${merged.claims.length} claims after merge, ${merged.layers.length} curated layers, ` +
      `${merged.anchors.length} anchors, ${merged.warnings.length} warnings`,
  );
  for (const w of merged.warnings) console.warn(`  ⚠ ${w}`);

  // Default chronology layer from Theographic min/max estimates.
  const theographicLayer: ChronologyLayer = {
    id: "theographic",
    label: "Estimates",
    attribution:
      "Year estimates from Theographic Bible Metadata (Viz.Bible), CC BY-SA 4.0",
    spans: {},
  };
  for (const id of merged.persons.keys()) {
    const extras = input.raw.get(id);
    if (!extras) continue; // overlay-added people have no theographic years
    const { birthYear, deathYear, minYear, maxYear } = extras;
    if (birthYear !== undefined && deathYear !== undefined) {
      theographicLayer.spans[id] = { birth: birthYear, death: deathYear, approx: false };
    } else if (minYear !== undefined && maxYear !== undefined) {
      theographicLayer.spans[id] = { active: [minYear, maxYear], approx: true };
    }
  }
  const layers = [theographicLayer, ...merged.layers];

  // Lineages: walk the curated great family lines over the merged claims.
  const lineageSpecs = loadLineageSpecs();
  const lineageResult = buildLineages(lineageSpecs, merged.claims, (id) =>
    merged.persons.has(id),
  );
  console.log(
    `lineages: ${lineageResult.lineages.length}/${lineageSpecs.length} walked (` +
      lineageResult.lineages.map((l) => `${l.id}:${l.people.length}`).join(", ") +
      `)`,
  );

  // Stage 5 — validate
  const result = validate({
    persons: merged.persons,
    claims: merged.claims,
    anchors: merged.anchors,
    layers,
  });
  result.errors.push(...lineageResult.errors);
  for (const w of result.warnings) console.warn(`  ⚠ ${w}`);
  if (result.errors.length > 0) {
    for (const e of result.errors) console.error(`  ✗ ${e}`);
    throw new Error(`validation failed with ${result.errors.length} error(s)`);
  }
  console.log(`validate: OK (${result.warnings.length} warnings)`);
  if (input.validateOnly) return;

  // Stage 6 — emit
  const outDir = cfg.paths.outDir;
  mkdirSync(outDir, { recursive: true });
  const write = (name: string, data: unknown): number => {
    const json = JSON.stringify(data);
    writeFileSync(join(outDir, name), json);
    console.log(`  emit ${name} (${(json.length / 1024).toFixed(0)}KB)`);
    return json.length;
  };

  const persons = [...merged.persons.values()].sort((a, b) => a.id.localeCompare(b.id));
  const claims = [...merged.claims].sort((a, b) => a.id.localeCompare(b.id));

  const search = new MiniSearch({
    fields: [...SEARCH_OPTIONS.fields],
    storeFields: [...SEARCH_OPTIONS.storeFields],
    idField: SEARCH_OPTIONS.idField,
  });
  search.addAll(
    persons.map((p) => ({
      id: p.id,
      primaryName: p.primaryName,
      variantNames: p.variants.map((v) => v.name).join(" "),
      disambiguator: p.disambiguator ?? "",
    })),
  );

  let total = 0;
  total += write("persons.json", { persons });
  total += write("claims.json", { claims });
  for (const layer of layers) {
    total += write(`chronology.${layer.id}.json`, layer);
  }
  total += write("anchors.json", { anchors: merged.anchors });
  total += write("lineages.json", { lineages: lineageResult.lineages });
  total += write("search-index.json", search.toJSON());

  const conflictGroups = new Set(claims.map((c) => c.conflictGroup).filter(Boolean));
  const manifest: Manifest = {
    datasetVersion: `theographic@${THEOGRAPHIC_COMMIT.slice(0, 7)}+curation`,
    generatedAt: new Date().toISOString(),
    counts: {
      persons: persons.length,
      claims: claims.length,
      conflictGroups: conflictGroups.size,
      anchors: merged.anchors.length,
    },
    chronologyLayers: layers.map((l) => ({
      id: l.id,
      label: l.label,
      attribution: l.attribution,
      file: `chronology.${l.id}.json`,
      coverage: Object.keys(l.spans).length,
    })),
    defaultChronologyLayer: "theographic",
    attribution:
      "Derived from Theographic Bible Metadata by Robert Rouse (Viz.Bible)",
    license: "CC BY-SA 4.0",
  };
  total += write("manifest.json", manifest);
  console.log(`emit: ${(total / 1024 / 1024).toFixed(2)}MB total raw`);
}
