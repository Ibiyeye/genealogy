/**
 * Stage 3 — Notability filter + lineage chain contraction.
 * Include a person iff verseCount >= threshold, OR they appear in a
 * genealogy chapter, OR force-included — and not force-excluded.
 * Where a parent_of chain runs through excluded people between two included
 * people, synthesize an ancestor_of claim naming the elided links.
 */
import type { Claim, Person, PersonId, VerseRef } from "@genealogy/schema";
import { parseVerseRef } from "@genealogy/schema";

export interface GenealogyChapterSpec {
  /** book code → chapter ranges, e.g. { "1Chr": [[1,9]], Gen: [[5,5],[10,11]] } */
  [book: string]: Array<[number, number]>;
}

export interface NotabilityInput {
  persons: Map<PersonId, Person>;
  claims: Claim[];
  /** Full resolved verse refs per person (pre-cap), for chapter membership. */
  fullRefs: Map<PersonId, VerseRef[]>;
  genealogyChapters: GenealogyChapterSpec;
  verseCountThreshold: number;
  forceInclude: Set<PersonId>;
  forceExclude: Set<PersonId>;
}

export interface NotabilityResult {
  included: Set<PersonId>;
  claims: Claim[];
  /** Why each person made the cut, for the stats report. */
  reasons: Map<PersonId, "verseCount" | "genealogyChapter" | "forced">;
}

export function inGenealogyChapter(
  refs: VerseRef[],
  spec: GenealogyChapterSpec,
): boolean {
  for (const ref of refs) {
    const p = parseVerseRef(ref);
    if (!p) continue;
    const ranges = spec[p.book];
    if (!ranges) continue;
    if (ranges.some(([lo, hi]) => p.chapter >= lo && p.chapter <= hi)) return true;
  }
  return false;
}

export function applyNotability(input: NotabilityInput): NotabilityResult {
  const { persons, claims, fullRefs, genealogyChapters, verseCountThreshold } = input;
  const included = new Set<PersonId>();
  const reasons = new Map<PersonId, "verseCount" | "genealogyChapter" | "forced">();

  for (const [id, person] of persons) {
    if (input.forceExclude.has(id)) continue;
    if (input.forceInclude.has(id)) {
      included.add(id);
      reasons.set(id, "forced");
    } else if (person.verseCount >= verseCountThreshold) {
      included.add(id);
      reasons.set(id, "verseCount");
    } else if (inGenealogyChapter(fullRefs.get(id) ?? [], genealogyChapters)) {
      included.add(id);
      reasons.set(id, "genealogyChapter");
    }
  }

  // Parent adjacency over the FULL claim set (conflict alternatives included:
  // contraction through either alternative is fine — the synthesized claim is
  // marked inferred and telescoped anyway).
  const childrenOf = new Map<PersonId, Array<{ child: PersonId }>>();
  for (const c of claims) {
    if (c.type !== "parent_of") continue;
    let list = childrenOf.get(c.from);
    if (!list) childrenOf.set(c.from, (list = []));
    list.push({ child: c.to });
  }

  // Chain contraction: from each included person, walk down through excluded
  // descendants; when an included person is reached, emit ancestor_of with
  // the elided names. Depth-capped to keep pathological chains bounded.
  const contracted: Claim[] = [];
  const MAX_ELIDED = 20;
  for (const ancestor of included) {
    const stack: Array<{ node: PersonId; elided: PersonId[] }> = (
      childrenOf.get(ancestor) ?? []
    ).map(({ child }) => ({ node: child, elided: [] }));
    const visited = new Set<PersonId>();
    while (stack.length > 0) {
      const { node, elided } = stack.pop()!;
      if (included.has(node)) {
        if (elided.length > 0) {
          const names = elided.map((id) => persons.get(id)?.primaryName ?? id);
          contracted.push({
            id: `ctr_ancestor_${ancestor}_${node}`,
            type: "ancestor_of",
            from: ancestor,
            to: node,
            citations: [],
            source: { tradition: "curated", document: "chain contraction" },
            confidence: "inferred",
            telescoped: true,
            note: `Lineage passes through ${names.join(", ")} (below notability threshold).`,
          });
        }
        continue; // included node becomes its own contraction root
      }
      if (visited.has(node) || elided.length >= MAX_ELIDED) continue;
      visited.add(node);
      for (const { child } of childrenOf.get(node) ?? []) {
        stack.push({ node: child, elided: [...elided, node] });
      }
    }
  }

  // Keep claims whose endpoints both survive; add contractions; drop dupes.
  const kept = claims.filter((c) => included.has(c.from) && included.has(c.to));
  const keptIds = new Set(kept.map((c) => c.id));
  for (const c of contracted) {
    if (!keptIds.has(c.id)) {
      keptIds.add(c.id);
      kept.push(c);
    }
  }

  return { included, claims: kept, reasons };
}
