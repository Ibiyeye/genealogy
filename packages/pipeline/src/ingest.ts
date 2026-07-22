/**
 * Stage 1 — Ingest: Theographic people.json (Airtable export) → canonical
 * Persons + Claims. Import claims are tagged source.tradition "theographic"
 * (low-trust; the curation overlay upgrades or retracts key ones).
 * Every data surprise is recorded in `anomalies` rather than thrown.
 */
import type { Claim, Person, PersonId } from "@genealogy/schema";
import type { TheoPerson } from "./theographic.js";
import { firstYear } from "./year.js";

export interface IngestResult {
  persons: Map<PersonId, Person>;
  claims: Claim[];
  /** Airtable record id → PersonId, for resolving relationship arrays. */
  recToId: Map<string, PersonId>;
  /** PersonId → raw Theographic fields we need in later stages. */
  raw: Map<PersonId, TheoRawExtras>;
  anomalies: string[];
}

export interface TheoRawExtras {
  verseRecIds: string[];
  memberOfRecIds: string[];
  minYear?: number | undefined;
  maxYear?: number | undefined;
  birthYear?: number | undefined;
  deathYear?: number | undefined;
}

function normalizeGender(g: string | undefined): "male" | "female" | undefined {
  if (g === "Male") return "male";
  if (g === "Female") return "female";
  return undefined;
}

function splitAlsoCalled(raw: unknown): string[] {
  const parts = Array.isArray(raw)
    ? raw.map(String)
    : typeof raw === "string"
      ? raw.split(/[,;/]/)
      : [];
  return parts
    .map((s) => s.trim())
    // Common-noun reference words ("mother", "daughter", "concubine") appear
    // in alsoCalled for unnamed figures; real name variants are capitalized.
    .filter((s) => s.length > 0 && s[0] === s[0]?.toUpperCase());
}

export function ingest(theoPersons: TheoPerson[]): IngestResult {
  const anomalies: string[] = [];
  const persons = new Map<PersonId, Person>();
  const recToId = new Map<string, PersonId>();
  const raw = new Map<PersonId, TheoRawExtras>();

  // Pass 1: identity.
  for (const rec of theoPersons) {
    const f = rec.fields;
    if (!f.personLookup || !f.name) {
      anomalies.push(`record ${rec.id}: missing personLookup or name — skipped`);
      continue;
    }
    const id = f.personLookup;
    if (recToId.has(rec.id) || persons.has(id)) {
      anomalies.push(`record ${rec.id}: duplicate id ${id} — skipped`);
      continue;
    }
    recToId.set(rec.id, id);

    const gender = normalizeGender(f.gender);
    if (f.gender && !gender && f.gender !== "Unknown") {
      anomalies.push(`${id}: unrecognized gender "${f.gender}"`);
    }

    // displayTitle patterns observed in the export:
    //   "Mary (mother of Jesus)"  → name + parenthesized disambiguator
    //   "Mary Magdalene"          → name + bare disambiguator suffix
    //   "Jacob (Israel)"          → preferred name differs from `name` field,
    //                               which holds the parenthesized alternate
    let primaryName = f.name;
    let disambiguator: string | undefined;
    const extraVariants: string[] = [];
    const dt = (f.displayTitle ?? "").trim();
    const paren = /^(.+?)\s*\((.+)\)$/.exec(dt);
    if (paren?.[1] && paren[2]) {
      if (dt.startsWith(f.name)) {
        disambiguator = paren[2].trim();
      } else if (paren[2].trim() === f.name) {
        // Swapped-name case: displayTitle leads with the better-known name.
        primaryName = paren[1].trim();
        extraVariants.push(f.name);
      }
    } else if (dt.startsWith(`${f.name} `)) {
      disambiguator = dt.slice(f.name.length).trim();
    }

    const person: Person = {
      id,
      primaryName,
      variants: [...splitAlsoCalled(f.alsoCalled), ...extraVariants]
        .filter((n, i, arr) => n !== primaryName && arr.indexOf(n) === i)
        .map((name) => ({ name, kind: "alt-spelling" as const, citations: [] })),
      citations: [], // filled by verse resolution
      verseCount: typeof f.verseCount === "number" ? f.verseCount : 0,
      groups: [], // filled from peopleGroups at emit time
      sourceIds: { theographic: rec.id },
    };
    if (gender) person.gender = gender;
    if (disambiguator) person.disambiguator = disambiguator;
    if (f.isProperName === false) person.unnamed = true;

    persons.set(id, person);
    raw.set(id, {
      verseRecIds: Array.isArray(f.verses) ? f.verses : [],
      memberOfRecIds: Array.isArray(f.memberOf) ? f.memberOf : [],
      minYear: firstYear(f.minYear),
      maxYear: firstYear(f.maxYear),
      birthYear: firstYear(f.birthYear),
      deathYear: firstYear(f.deathYear),
    });
  }

  // Pass 2: relationships.
  const claims: Claim[] = [];
  const seenClaimIds = new Set<string>();

  const addClaim = (claim: Claim): void => {
    if (seenClaimIds.has(claim.id)) return;
    seenClaimIds.add(claim.id);
    claims.push(claim);
  };

  const resolve = (recId: string, ownerId: PersonId, field: string): PersonId | undefined => {
    const target = recToId.get(recId);
    if (!target) anomalies.push(`${ownerId}: ${field} references unknown record ${recId}`);
    return target;
  };

  const theographicSource = { tradition: "theographic" as const };

  for (const rec of theoPersons) {
    const f = rec.fields;
    const id = f.personLookup ? recToId.get(rec.id) : undefined;
    if (!id) continue;

    for (const [field, kind] of [
      ["father", "father"],
      ["mother", "mother"],
    ] as const) {
      const arr = f[field] ?? [];
      if (arr.length > 1) {
        anomalies.push(`${id}: ${arr.length} ${kind}s listed — importing all (review for conflict curation)`);
      }
      for (const recId of arr) {
        const parent = resolve(recId, id, field);
        if (!parent || parent === id) continue;
        addClaim({
          id: `thg_parent_${parent}_${id}`,
          type: "parent_of",
          from: parent,
          to: id,
          citations: [],
          source: theographicSource,
          confidence: "explicit",
        });
      }
    }

    for (const recId of f.partners ?? []) {
      const partner = resolve(recId, id, "partners");
      if (!partner || partner === id) continue;
      const [a, b] = [id, partner].sort();
      addClaim({
        id: `thg_spouse_${a}_${b}`,
        type: "spouse_of",
        from: a!,
        to: b!,
        citations: [],
        source: theographicSource,
        confidence: "explicit",
      });
    }

    for (const recId of f.siblings ?? []) {
      const sibling = resolve(recId, id, "siblings");
      if (!sibling || sibling === id) continue;
      const [a, b] = [id, sibling].sort();
      addClaim({
        id: `thg_sibling_${a}_${b}`,
        type: "sibling_of",
        from: a!,
        to: b!,
        citations: [],
        source: theographicSource,
        confidence: "inferred",
      });
    }

  }

  // Pass 3: children[] should mirror father/mother on the child record.
  // Runs after ALL father/mother claims exist so record order can't cause
  // false positives.
  for (const rec of theoPersons) {
    const f = rec.fields;
    const id = recToId.get(rec.id);
    if (!id) continue;
    for (const recId of f.children ?? []) {
      const child = resolve(recId, id, "children");
      if (!child || child === id) continue;
      const claimId = `thg_parent_${id}_${child}`;
      if (!seenClaimIds.has(claimId)) {
        anomalies.push(`${id}: child ${child} lacks reciprocal parent link — claim added from children[]`);
        addClaim({
          id: claimId,
          type: "parent_of",
          from: id,
          to: child,
          citations: [],
          source: theographicSource,
          confidence: "explicit",
        });
      }
    }
  }

  return { persons, claims, recToId, raw, anomalies };
}
