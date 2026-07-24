import MiniSearch from "minisearch";
import type {
  Anchor,
  Claim,
  ChronologyLayer,
  Lineage,
  Manifest,
  Person,
  PersonId,
} from "@genealogy/schema";

/** Must match the pipeline's SEARCH_OPTIONS (stages456.ts). */
const SEARCH_OPTIONS = {
  fields: ["primaryName", "variantNames", "disambiguator"],
  storeFields: [] as string[],
  idField: "id",
};

export interface Dataset {
  persons: Map<PersonId, Person>;
  claims: Claim[];
  claimsById: Map<string, Claim>;
  /** Every claim touching a person, both directions. */
  claimsByPerson: Map<PersonId, Claim[]>;
  conflictGroups: Map<string, Claim[]>;
  lineages: Lineage[];
  anchors: Anchor[];
  /** Default chronology layer (Theographic estimates), loaded eagerly. */
  years: ChronologyLayer;
  manifest: Manifest;
  search: MiniSearch;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

export async function loadDataset(base = "/data"): Promise<Dataset> {
  const manifest = await fetchJson<Manifest>(`${base}/manifest.json`);
  const defaultLayerMeta = manifest.chronologyLayers.find(
    (l) => l.id === manifest.defaultChronologyLayer,
  );
  const [personsArtifact, claimsArtifact, lineagesArtifact, anchorsArtifact, years, searchJson] =
    await Promise.all([
      fetchJson<{ persons: Person[] }>(`${base}/persons.json`),
      fetchJson<{ claims: Claim[] }>(`${base}/claims.json`),
      fetchJson<{ lineages: Lineage[] }>(`${base}/lineages.json`),
      fetchJson<{ anchors: Anchor[] }>(`${base}/anchors.json`),
      fetchJson<ChronologyLayer>(`${base}/${defaultLayerMeta?.file ?? "chronology.theographic.json"}`),
      fetch(`${base}/search-index.json`).then((r) => r.text()),
    ]);

  const persons = new Map(personsArtifact.persons.map((p) => [p.id, p]));
  const claims = claimsArtifact.claims;
  const claimsById = new Map(claims.map((c) => [c.id, c]));

  const claimsByPerson = new Map<PersonId, Claim[]>();
  const touch = (id: PersonId, claim: Claim): void => {
    let list = claimsByPerson.get(id);
    if (!list) claimsByPerson.set(id, (list = []));
    list.push(claim);
  };
  const conflictGroups = new Map<string, Claim[]>();
  for (const claim of claims) {
    touch(claim.from, claim);
    touch(claim.to, claim);
    if (claim.conflictGroup) {
      let group = conflictGroups.get(claim.conflictGroup);
      if (!group) conflictGroups.set(claim.conflictGroup, (group = []));
      group.push(claim);
    }
  }

  const search = MiniSearch.loadJSON(searchJson, SEARCH_OPTIONS);

  return {
    persons,
    claims,
    claimsById,
    claimsByPerson,
    conflictGroups,
    lineages: lineagesArtifact.lineages,
    anchors: anchorsArtifact.anchors,
    years,
    manifest,
    search,
  };
}

/** "1085–1015 BC" for dated people, "c. 2100–1900 BC" for floruit ranges. */
export function lifespanLabel(dataset: Dataset, id: PersonId): string | null {
  const span = dataset.years.spans[id];
  if (!span) return null;
  const fmt = (y: number): string => (y < 0 ? `${-y}` : `AD ${y}`);
  const era = (y: number): string => (y < 0 ? " BC" : "");
  if (span.birth !== undefined && span.death !== undefined) {
    return `${fmt(span.birth)}–${fmt(span.death)}${era(span.death)}`;
  }
  if (span.active) {
    return `c. ${fmt(span.active[0])}–${fmt(span.active[1])}${era(span.active[1])}`;
  }
  return null;
}
