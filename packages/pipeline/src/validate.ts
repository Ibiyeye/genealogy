/**
 * Stage 5 — Validation. Hard failures abort the build; warnings are
 * printed and written to the report for curation review.
 */
import type { Anchor, Claim, ChronologyLayer, Person, PersonId } from "@genealogy/schema";
import { isValidVerseRef } from "@genealogy/schema";

export interface ValidationInput {
  persons: Map<PersonId, Person>;
  claims: Claim[];
  anchors: Anchor[];
  layers: ChronologyLayer[];
}

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

function anchorPersonIds(anchor: Anchor): PersonId[] {
  switch (anchor.kind) {
    case "lifespan":
    case "regnal_length":
      return [anchor.person];
    case "age_at_fatherhood":
      return [anchor.parent, anchor.child];
    case "synchronism":
      return [anchor.person, anchor.inYearOfReignOf];
    case "event_offset":
      return [anchor.person];
  }
}

export function validate(input: ValidationInput): ValidationResult {
  const { persons, claims, anchors, layers } = input;
  const errors: string[] = [];
  const warnings: string[] = [];

  // --- referential integrity + duplicate claim ids ---
  const seenClaimIds = new Set<string>();
  for (const claim of claims) {
    if (seenClaimIds.has(claim.id)) errors.push(`duplicate claim id ${claim.id}`);
    seenClaimIds.add(claim.id);
    for (const end of [claim.from, claim.to]) {
      if (!persons.has(end)) errors.push(`claim ${claim.id}: dangling person "${end}"`);
    }
    const citationExempt =
      claim.confidence === "traditional" ||
      claim.confidence === "inferred" ||
      claim.source.tradition === "theographic";
    if (claim.citations.length === 0 && !citationExempt) {
      errors.push(`claim ${claim.id}: citations required for confidence "${claim.confidence}"`);
    }
    for (const ref of claim.citations) {
      if (!isValidVerseRef(ref)) errors.push(`claim ${claim.id}: invalid verse ref "${ref}"`);
    }
  }

  for (const anchor of anchors) {
    for (const id of anchorPersonIds(anchor)) {
      if (!persons.has(id)) errors.push(`anchor (${anchor.kind}): dangling person "${id}"`);
    }
    for (const ref of anchor.citations) {
      if (!isValidVerseRef(ref)) errors.push(`anchor (${anchor.kind}): invalid verse ref "${ref}"`);
    }
  }

  const layerIds = new Set<string>();
  for (const layer of layers) {
    if (layerIds.has(layer.id)) errors.push(`duplicate chronology layer id ${layer.id}`);
    layerIds.add(layer.id);
    for (const id of Object.keys(layer.spans)) {
      if (!persons.has(id)) errors.push(`layer ${layer.id}: span for unknown person "${id}"`);
    }
  }

  // --- conflict groups need >= 2 members ---
  const groupMembers = new Map<string, number>();
  for (const claim of claims) {
    if (claim.conflictGroup) {
      groupMembers.set(claim.conflictGroup, (groupMembers.get(claim.conflictGroup) ?? 0) + 1);
    }
  }
  for (const [group, count] of groupMembers) {
    if (count < 2) errors.push(`conflict group ${group} has only ${count} member`);
  }

  // --- parent_of cycles (a person their own ancestor) ---
  // Conflict-group alternatives all participate: a cycle through EITHER
  // alternative is still a data error.
  const childrenOf = new Map<PersonId, PersonId[]>();
  for (const claim of claims) {
    if (claim.type !== "parent_of" && claim.type !== "ancestor_of") continue;
    let list = childrenOf.get(claim.from);
    if (!list) childrenOf.set(claim.from, (list = []));
    list.push(claim.to);
  }
  const state = new Map<PersonId, "visiting" | "done">();
  const visit = (node: PersonId, path: PersonId[]): void => {
    if (state.get(node) === "done") return;
    if (state.get(node) === "visiting") {
      const cycleStart = path.indexOf(node);
      errors.push(`ancestry cycle: ${[...path.slice(cycleStart), node].join(" → ")}`);
      return;
    }
    state.set(node, "visiting");
    for (const child of childrenOf.get(node) ?? []) visit(child, [...path, node]);
    state.set(node, "done");
  };
  for (const id of childrenOf.keys()) visit(id, []);

  // --- warnings ---
  const touched = new Set<PersonId>();
  for (const claim of claims) {
    touched.add(claim.from);
    touched.add(claim.to);
  }
  const floating = [...persons.keys()].filter((id) => !touched.has(id));
  if (floating.length > 0) {
    warnings.push(
      `${floating.length} floating people with no claims (expected for Job etc.): ${floating.slice(0, 15).join(", ")}${floating.length > 15 ? ", …" : ""}`,
    );
  }

  for (const person of persons.values()) {
    for (const ref of person.citations) {
      if (!isValidVerseRef(ref)) errors.push(`person ${person.id}: invalid verse ref "${ref}"`);
    }
  }

  return { errors, warnings };
}
