/**
 * Curated lineage walking. Loads data/curation/lineages.yaml, walks each
 * chain through its waypoints over parent_of/ancestor_of claims (BFS,
 * shortest path), and returns ordered member lists with the claim linking
 * each step — so the UI can cite every hop. A lineage that cannot be
 * walked is a build error: the curation promised a line the data lacks.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import type { Claim, PersonId } from "@genealogy/schema";
import { PIPELINE_CONFIG } from "./config.js";

/**
 * Two shapes of collection:
 *   chain — a descent line, walked between waypoints over parent_of
 *   group — an explicit set (the twelve apostles, the writing prophets),
 *           which has no descent relationship between members
 */
const LineageSpecSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    subtitle: z.string().min(1),
    description: z.string().min(1),
    citation: z.string().min(1),
    kind: z.enum(["chain", "group"]).default("chain"),
    waypoints: z.array(z.string().min(1)).min(2).optional(),
    members: z.array(z.string().min(1)).min(2).optional(),
  })
  .superRefine((spec, ctx) => {
    if (spec.kind === "chain" && !spec.waypoints) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${spec.id}: chain needs waypoints` });
    }
    if (spec.kind === "group" && !spec.members) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${spec.id}: group needs members` });
    }
  });
const LineagesFileSchema = z.array(LineageSpecSchema);

export interface LineageStep {
  id: PersonId;
  /** Claim connecting the previous member to this one (null for the head). */
  claim: string | null;
}

export interface Lineage {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  citation: string;
  kind: "chain" | "group";
  people: LineageStep[];
}

export function loadLineageSpecs(
  dir: string = PIPELINE_CONFIG.paths.curation,
): z.infer<typeof LineageSpecSchema>[] {
  const path = join(dir, "lineages.yaml");
  if (!existsSync(path)) return [];
  return LineagesFileSchema.parse(parse(readFileSync(path, "utf8")) ?? []);
}

export function buildLineages(
  specs: z.infer<typeof LineageSpecSchema>[],
  claims: Claim[],
  personExists: (id: PersonId) => boolean,
): { lineages: Lineage[]; errors: string[] } {
  const errors: string[] = [];

  // Downward adjacency with the claim carried along. Conflict-group
  // alternatives all participate; BFS takes the shortest route, and
  // waypoints steer which branch a lineage follows. Generation-true
  // parent_of edges and telescoping ancestor_of shortcuts are kept in
  // separate graphs: a shortcut must never beat a complete chain (it
  // once routed the kings line David→Absalom→Abijah, skipping Solomon).
  const downParent = new Map<PersonId, Array<{ to: PersonId; claim: string }>>();
  const downAll = new Map<PersonId, Array<{ to: PersonId; claim: string }>>();
  for (const c of claims) {
    if (c.type !== "parent_of" && c.type !== "ancestor_of") continue;
    for (const map of c.type === "parent_of" ? [downParent, downAll] : [downAll]) {
      let list = map.get(c.from);
      if (!list) map.set(c.from, (list = []));
      list.push({ to: c.to, claim: c.id });
    }
  }

  const bfs = (
    down: Map<PersonId, Array<{ to: PersonId; claim: string }>>,
    from: PersonId,
    to: PersonId,
  ): Array<{ id: PersonId; claim: string | null }> | null => {
    if (from === to) return [{ id: from, claim: null }];
    const prev = new Map<PersonId, { id: PersonId; claim: string }>();
    const queue: PersonId[] = [from];
    const seen = new Set<PersonId>([from]);
    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const edge of down.get(cur) ?? []) {
        if (seen.has(edge.to)) continue;
        seen.add(edge.to);
        prev.set(edge.to, { id: cur, claim: edge.claim });
        if (edge.to === to) {
          const path: Array<{ id: PersonId; claim: string | null }> = [];
          let at: PersonId = to;
          while (at !== from) {
            const p = prev.get(at)!;
            path.unshift({ id: at, claim: p.claim });
            at = p.id;
          }
          path.unshift({ id: from, claim: null });
          return path;
        }
        queue.push(edge.to);
      }
    }
    return null;
  };

  const shortestPath = (
    from: PersonId,
    to: PersonId,
  ): Array<{ id: PersonId; claim: string | null }> | null =>
    bfs(downParent, from, to) ?? bfs(downAll, from, to);

  const lineages: Lineage[] = [];
  for (const spec of specs) {
    const meta = {
      id: spec.id,
      title: spec.title,
      subtitle: spec.subtitle,
      description: spec.description,
      citation: spec.citation,
      kind: spec.kind,
    };

    if (spec.kind === "group") {
      const members = spec.members ?? [];
      for (const m of members) {
        if (!personExists(m)) {
          errors.push(`collection ${spec.id}: member "${m}" is not in the dataset`);
        }
      }
      lineages.push({
        ...meta,
        people: members.map((id) => ({ id, claim: null })),
      });
      continue;
    }

    const waypoints = spec.waypoints ?? [];
    for (const wp of waypoints) {
      if (!personExists(wp)) {
        errors.push(`lineage ${spec.id}: waypoint "${wp}" is not in the dataset`);
      }
    }
    const people: LineageStep[] = [];
    let ok = true;
    for (let i = 0; i < waypoints.length - 1; i++) {
      const from = waypoints[i]!;
      const to = waypoints[i + 1]!;
      const segment = shortestPath(from, to);
      if (!segment) {
        errors.push(`lineage ${spec.id}: no descent path ${from} → ${to}`);
        ok = false;
        break;
      }
      // Skip the segment head when appending (it's the previous tail).
      people.push(...(people.length === 0 ? segment : segment.slice(1)));
    }
    if (ok) lineages.push({ ...meta, people });
  }
  return { lineages, errors };
}
