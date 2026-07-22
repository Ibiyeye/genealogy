/**
 * Stage 4 — Curation overlay merge. Loads hand-edited YAML under
 * data/curation/ and applies it over the imported dataset. Overlay wins.
 * Operations: add/patch person, add claim, retract imported claim, patch
 * imported claim, define conflict groups, define chronology layers+anchors.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import {
  ClaimSchema,
  NameVariantSchema,
  VerseRefSchema,
  AnchorSchema,
  ChronologySpanSchema,
  type Anchor,
  type Claim,
  type ChronologyLayer,
  type Person,
  type PersonId,
} from "@genealogy/schema";
import { PIPELINE_CONFIG } from "./config.js";

// ---------- YAML file schemas ----------

const PersonEntrySchema = z.object({
  id: z.string().min(1),
  primaryName: z.string().optional(),
  disambiguator: z.string().optional(),
  gender: z.enum(["male", "female"]).optional(),
  unnamed: z.boolean().optional(),
  bio: z.string().optional(),
  citations: z.array(VerseRefSchema).optional(),
  groups: z.array(z.string()).optional(),
  /** Merged into existing variants by name; replaces kind/citations. */
  variants: z.array(NameVariantSchema).optional(),
});
const PeopleFileSchema = z.array(PersonEntrySchema);

const ClaimSpecSchema = ClaimSchema; // same shape as canonical claims

const ConflictEntrySchema = z.object({
  group: z.string().min(1),
  about: z.string().min(1),
  retract: z.array(z.string()).default([]),
  claims: z.array(z.record(z.string(), z.unknown())).min(1),
});
const ConflictsFileSchema = z.array(ConflictEntrySchema);

const ClaimPatchSchema = z.object({
  id: z.string().min(1),
  set: z
    .object({
      citations: z.array(VerseRefSchema).optional(),
      confidence: z.enum(["explicit", "inferred", "traditional", "disputed"]).optional(),
      conflictGroup: z.string().optional(),
      telescoped: z.boolean().optional(),
      note: z.string().optional(),
      source: z
        .object({
          tradition: z.enum(["MT", "LXX", "NT", "theographic", "curated"]),
          document: z.string().optional(),
        })
        .optional(),
    })
    .refine((s) => Object.keys(s).length > 0, "empty patch"),
});
const ClaimPatchesFileSchema = z.array(ClaimPatchSchema);

const ChronologyFileSchema = z.object({
  layer: z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    attribution: z.string().min(1),
  }),
  spans: z.record(z.string(), ChronologySpanSchema).default({}),
  anchors: z.array(AnchorSchema).default([]),
});

// ---------- Loading ----------

export interface OverlayData {
  people: z.infer<typeof PersonEntrySchema>[];
  flatClaims: Claim[];
  conflicts: z.infer<typeof ConflictEntrySchema>[];
  claimPatches: z.infer<typeof ClaimPatchSchema>[];
  chronologyLayers: Array<ChronologyLayer & { anchors: Anchor[] }>;
}

function loadYaml(path: string): unknown {
  return parse(readFileSync(path, "utf8"));
}

export function loadOverlay(dir: string = PIPELINE_CONFIG.paths.curation): OverlayData {
  const overlay: OverlayData = {
    people: [],
    flatClaims: [],
    conflicts: [],
    claimPatches: [],
    chronologyLayers: [],
  };

  const peopleDir = join(dir, "people");
  if (existsSync(peopleDir)) {
    for (const file of readdirSync(peopleDir).filter((f) => f.endsWith(".yaml")).sort()) {
      const raw = loadYaml(join(peopleDir, file));
      if (raw == null) continue;
      try {
        overlay.people.push(...PeopleFileSchema.parse(raw));
      } catch (err) {
        throw new Error(`people/${file}: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  const claimsDir = join(dir, "claims");
  if (existsSync(claimsDir)) {
    for (const file of readdirSync(claimsDir).filter((f) => f.endsWith(".yaml")).sort()) {
      const raw = loadYaml(join(claimsDir, file));
      if (raw == null) continue;
      try {
        if (file === "conflicts.yaml") {
          const entries = ConflictsFileSchema.parse(raw);
          for (const entry of entries) {
            overlay.conflicts.push({
              ...entry,
              // Force each claim into its group before full validation.
              claims: entry.claims.map((c) => ({ ...c, conflictGroup: entry.group })),
            });
          }
        } else if (file === "patches.yaml") {
          overlay.claimPatches.push(...ClaimPatchesFileSchema.parse(raw));
        } else {
          overlay.flatClaims.push(...z.array(ClaimSpecSchema).parse(raw));
        }
      } catch (err) {
        throw new Error(`claims/${file}: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  const chronoDir = join(dir, "chronology");
  if (existsSync(chronoDir)) {
    for (const file of readdirSync(chronoDir).filter((f) => f.endsWith(".yaml")).sort()) {
      const raw = loadYaml(join(chronoDir, file));
      if (raw == null) continue;
      try {
        const parsed = ChronologyFileSchema.parse(raw);
        overlay.chronologyLayers.push({
          id: parsed.layer.id,
          label: parsed.layer.label,
          attribution: parsed.layer.attribution,
          spans: parsed.spans,
          anchors: parsed.anchors,
        });
      } catch (err) {
        throw new Error(`chronology/${file}: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  return overlay;
}

// ---------- Merging ----------

export interface MergeResult {
  persons: Map<PersonId, Person>;
  claims: Claim[];
  anchors: Anchor[];
  layers: ChronologyLayer[];
  /** Ids of overlay-added people (always included regardless of filter). */
  addedPeople: Set<PersonId>;
  warnings: string[];
}

export function applyOverlay(
  persons: Map<PersonId, Person>,
  claims: Claim[],
  overlay: OverlayData,
): MergeResult {
  const warnings: string[] = [];
  const mergedPersons = new Map(persons);
  const addedPeople = new Set<PersonId>();

  for (const entry of overlay.people) {
    const existing = mergedPersons.get(entry.id);
    if (existing) {
      const patched: Person = { ...existing };
      if (entry.primaryName) patched.primaryName = entry.primaryName;
      if (entry.disambiguator) patched.disambiguator = entry.disambiguator;
      if (entry.gender) patched.gender = entry.gender;
      if (entry.unnamed !== undefined) patched.unnamed = entry.unnamed;
      if (entry.bio) patched.bio = entry.bio;
      if (entry.citations) patched.citations = entry.citations;
      if (entry.groups) patched.groups = [...new Set([...patched.groups, ...entry.groups])];
      if (entry.variants) {
        const byName = new Map(patched.variants.map((v) => [v.name, v]));
        for (const v of entry.variants) byName.set(v.name, v);
        // A curated variant matching the primary name replaces nothing; drop it.
        byName.delete(patched.primaryName);
        patched.variants = [...byName.values()];
      }
      mergedPersons.set(entry.id, patched);
    } else {
      if (!entry.primaryName) {
        throw new Error(`overlay person ${entry.id}: new person requires primaryName`);
      }
      const person: Person = {
        id: entry.id,
        primaryName: entry.primaryName,
        variants: entry.variants ?? [],
        citations: entry.citations ?? [],
        verseCount: entry.citations?.length ?? 0,
        groups: entry.groups ?? [],
        sourceIds: {},
      };
      if (entry.disambiguator) person.disambiguator = entry.disambiguator;
      if (entry.gender) person.gender = entry.gender;
      if (entry.unnamed !== undefined) person.unnamed = entry.unnamed;
      if (entry.bio) person.bio = entry.bio;
      mergedPersons.set(entry.id, person);
      addedPeople.add(entry.id);
    }
  }

  // Claims: retract → patch → add.
  const retracted = new Set(overlay.conflicts.flatMap((c) => c.retract));
  const byId = new Map<string, Claim>();
  for (const claim of claims) {
    if (!retracted.has(claim.id)) byId.set(claim.id, claim);
  }
  for (const id of retracted) {
    if (!claims.some((c) => c.id === id)) {
      warnings.push(`retraction targets unknown claim id "${id}" (already gone or typo)`);
    }
  }

  for (const patch of overlay.claimPatches) {
    const claim = byId.get(patch.id);
    if (!claim) {
      warnings.push(`claim patch targets unknown claim id "${patch.id}"`);
      continue;
    }
    byId.set(patch.id, ClaimSchema.parse({ ...claim, ...patch.set }));
  }

  const addClaim = (spec: unknown, context: string): void => {
    const claim = ClaimSchema.parse(spec);
    if (byId.has(claim.id)) {
      throw new Error(`${context}: duplicate claim id "${claim.id}"`);
    }
    byId.set(claim.id, claim);
  };
  for (const claim of overlay.flatClaims) addClaim(claim, "claims file");
  for (const conflict of overlay.conflicts) {
    for (const spec of conflict.claims) addClaim(spec, `conflict ${conflict.group}`);
  }

  const anchors = overlay.chronologyLayers.flatMap((l) => l.anchors);
  const layers: ChronologyLayer[] = overlay.chronologyLayers.map(
    ({ id, label, attribution, spans }) => ({ id, label, attribution, spans }),
  );

  return {
    persons: mergedPersons,
    claims: [...byId.values()],
    anchors,
    layers,
    addedPeople,
    warnings,
  };
}
