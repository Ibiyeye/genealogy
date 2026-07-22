import { describe, expect, it } from "vitest";
import type { Claim } from "@genealogy/schema";
import { computeSubgraph } from "../src/graph/subgraph.js";
import { DEFAULT_VISIBLE_TYPES } from "../src/store.js";

function claim(id: string, type: Claim["type"], from: string, to: string): Claim {
  return {
    id,
    type,
    from,
    to,
    citations: [],
    source: { tradition: "theographic" },
    confidence: type === "sibling_of" ? "inferred" : "explicit",
  };
}

// Chain: g2 → g1 → focus → c1 → c2 → c3; focus ⚭ wife; wife's father wf;
// focus mentored_by mentor; sibling s.
const claims: Claim[] = [
  claim("e1", "parent_of", "g2", "g1"),
  claim("e2", "parent_of", "g1", "focus"),
  claim("e3", "parent_of", "focus", "c1"),
  claim("e4", "parent_of", "c1", "c2"),
  claim("e5", "parent_of", "c2", "c3"),
  claim("e6", "spouse_of", "focus", "wife"),
  claim("e7", "parent_of", "wf", "wife"),
  claim("e8", "mentored_by", "focus", "mentor"),
  claim("e9", "sibling_of", "focus", "s"),
];

const base = {
  focus: "focus",
  depth: 2,
  expandedIds: new Set<string>(),
  claims,
  visibleTypes: new Set(DEFAULT_VISIBLE_TYPES),
};

describe("computeSubgraph", () => {
  it("walks lineage depth generations both directions", () => {
    const g = computeSubgraph(base);
    expect(g.nodes.has("g2")).toBe(true); // 2 up
    expect(g.nodes.has("c2")).toBe(true); // 2 down
    expect(g.nodes.has("c3")).toBe(false); // 3 down — beyond depth
  });

  it("pulls in spouses of included nodes without extending frontier", () => {
    const g = computeSubgraph(base);
    expect(g.nodes.has("wife")).toBe(true);
    // wife's father is NOT pulled in by marriage alone…
    expect(g.nodes.has("wf")).toBe(false);
    // …but wife shows a frontier badge for him.
    expect(g.frontier.get("wife")).toBe(1);
  });

  it("only includes edges of visible types with both endpoints present", () => {
    const g = computeSubgraph(base);
    const ids = g.edges.map((e) => e.id);
    expect(ids).toContain("e6"); // spouse edge visible by default
    expect(ids).not.toContain("e8"); // mentorship hidden by default
    expect(ids).not.toContain("e5"); // c3 not present
  });

  it("shows hidden-type edges once the type is toggled on", () => {
    const g = computeSubgraph({
      ...base,
      visibleTypes: new Set([...DEFAULT_VISIBLE_TYPES, "mentored_by" as const]),
    });
    // mentor is not in the node set (not lineage/partner), so still no edge…
    expect(g.edges.map((e) => e.id)).not.toContain("e8");
    // …until mentor enters via expansion of some included node — mentor has
    // no lineage here, so simulate by focusing on it.
    const g2 = computeSubgraph({
      ...base,
      focus: "mentor",
      visibleTypes: new Set(["mentored_by" as const]),
    });
    expect(g2.nodes.has("mentor")).toBe(true);
  });

  it("expansion walks the frontier outward", () => {
    const before = computeSubgraph(base);
    expect(before.nodes.has("c3")).toBe(false);
    expect(before.frontier.get("c2")).toBe(1);
    const after = computeSubgraph({ ...base, expandedIds: new Set(["c2"]) });
    expect(after.nodes.has("c3")).toBe(true);
    expect(after.frontier.has("c2")).toBe(false);
  });

  it("frontier counts hidden lineage neighbors", () => {
    const g = computeSubgraph({ ...base, depth: 1 });
    // g1 has hidden parent g2.
    expect(g.frontier.get("g1")).toBe(1);
    expect(g.nodes.has("g2")).toBe(false);
  });

  it("handles a floating focus with no claims", () => {
    const g = computeSubgraph({ ...base, focus: "job" });
    expect(g.nodes.size).toBe(1);
    expect(g.edges).toHaveLength(0);
    expect(g.frontier.size).toBe(0);
  });

  it("conflict alternatives both appear as edges", () => {
    const conflictClaims = [
      claim("f1", "parent_of", "jacob", "joseph"),
      { ...claim("f2", "parent_of", "heli", "joseph"), conflictGroup: "cg" },
    ];
    const g = computeSubgraph({
      focus: "joseph",
      depth: 1,
      expandedIds: new Set(),
      claims: conflictClaims,
      visibleTypes: new Set(DEFAULT_VISIBLE_TYPES),
    });
    expect(g.nodes.has("jacob")).toBe(true);
    expect(g.nodes.has("heli")).toBe(true);
    expect(g.edges).toHaveLength(2);
  });
});
