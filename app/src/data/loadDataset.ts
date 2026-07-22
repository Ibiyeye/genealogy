import MiniSearch from "minisearch";
import type {
  Claim,
  ChronologyLayer,
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
  manifest: Manifest;
  search: MiniSearch;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

export async function loadDataset(base = "/data"): Promise<Dataset> {
  const [personsArtifact, claimsArtifact, manifest, searchJson] = await Promise.all([
    fetchJson<{ persons: Person[] }>(`${base}/persons.json`),
    fetchJson<{ claims: Claim[] }>(`${base}/claims.json`),
    fetchJson<Manifest>(`${base}/manifest.json`),
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

  return { persons, claims, claimsById, claimsByPerson, conflictGroups, manifest, search };
}

export async function loadChronologyLayer(
  file: string,
  base = "/data",
): Promise<ChronologyLayer> {
  return fetchJson<ChronologyLayer>(`${base}/${file}`);
}
