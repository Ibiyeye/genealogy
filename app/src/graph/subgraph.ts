/**
 * Focus-and-expand subgraph computation. Pure and unit-testable.
 *
 * From the focus person, BFS along lineage edges (parent_of / ancestor_of,
 * both directions) to `depth` generations; user-expanded frontier nodes get
 * their own neighborhood pulled in. Spouses/concubines of included people
 * join, then every other visible-typed claim whose endpoints are BOTH
 * already present. Frontier nodes carry a badge count of hidden lineage
 * neighbors.
 */
import type { Claim, ClaimType, PersonId } from "@genealogy/schema";

const LINEAGE: ReadonlySet<ClaimType> = new Set(["parent_of", "ancestor_of"]);
const PARTNER: ReadonlySet<ClaimType> = new Set(["spouse_of", "concubine_of"]);

export interface SubgraphInput {
  focus: PersonId;
  depth: number;
  expandedIds: ReadonlySet<PersonId>;
  claims: Claim[];
  visibleTypes: ReadonlySet<ClaimType>;
}

export interface Subgraph {
  nodes: Set<PersonId>;
  edges: Claim[];
  /** Nodes with hidden lineage neighbors → count of those neighbors. */
  frontier: Map<PersonId, number>;
}

interface Adjacency {
  lineage: Map<PersonId, PersonId[]>;
  partners: Map<PersonId, PersonId[]>;
}

function buildAdjacency(claims: Claim[]): Adjacency {
  const lineage = new Map<PersonId, PersonId[]>();
  const partners = new Map<PersonId, PersonId[]>();
  const push = (m: Map<PersonId, PersonId[]>, k: PersonId, v: PersonId): void => {
    let list = m.get(k);
    if (!list) m.set(k, (list = []));
    list.push(v);
  };
  for (const c of claims) {
    if (LINEAGE.has(c.type)) {
      push(lineage, c.from, c.to);
      push(lineage, c.to, c.from);
    } else if (PARTNER.has(c.type)) {
      push(partners, c.from, c.to);
      push(partners, c.to, c.from);
    }
  }
  return { lineage, partners };
}

export function computeSubgraph(input: SubgraphInput): Subgraph {
  const { focus, depth, expandedIds, claims, visibleTypes } = input;
  const adj = buildAdjacency(claims);

  // BFS over lineage from focus (and from each expanded node with its own
  // fresh depth budget, so expansion walks outward organically).
  const nodes = new Set<PersonId>([focus]);
  const queue: Array<{ id: PersonId; remaining: number }> = [
    { id: focus, remaining: depth },
  ];
  for (const id of expandedIds) {
    if (adj.lineage.has(id) || adj.partners.has(id)) {
      nodes.add(id);
      queue.push({ id, remaining: 1 });
    }
  }
  const bestRemaining = new Map<PersonId, number>();
  while (queue.length > 0) {
    const { id, remaining } = queue.shift()!;
    if ((bestRemaining.get(id) ?? -1) >= remaining) continue;
    bestRemaining.set(id, remaining);
    if (remaining === 0) continue;
    for (const next of adj.lineage.get(id) ?? []) {
      nodes.add(next);
      queue.push({ id: next, remaining: remaining - 1 });
    }
  }

  // Partners of every included node join (they don't extend the frontier).
  for (const id of [...nodes]) {
    for (const partner of adj.partners.get(id) ?? []) nodes.add(partner);
  }

  // Edges: any visible-typed claim with both endpoints present.
  const edges = claims.filter(
    (c) => visibleTypes.has(c.type) && nodes.has(c.from) && nodes.has(c.to),
  );

  // Frontier badges: hidden lineage neighbors of included nodes.
  const frontier = new Map<PersonId, number>();
  for (const id of nodes) {
    const hidden = (adj.lineage.get(id) ?? []).filter((n) => !nodes.has(n)).length;
    if (hidden > 0) frontier.set(id, hidden);
  }

  return { nodes, edges, frontier };
}
