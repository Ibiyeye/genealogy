/**
 * computeSubgraph against the real emitted dataset (skipped if not built).
 * These pin the M5 manual-verification numbers.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Claim } from "@genealogy/schema";
import { computeSubgraph } from "../src/graph/subgraph.js";
import { DEFAULT_VISIBLE_TYPES } from "../src/store.js";

const dataDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "data");
const built = existsSync(join(dataDir, "claims.json"));

describe.skipIf(!built)("computeSubgraph on the real dataset", () => {
  const { claims } = JSON.parse(
    readFileSync(join(dataDir, "claims.json"), "utf8"),
  ) as { claims: Claim[] };

  const run = (focus: string, depth = 2, expanded: string[] = []) =>
    computeSubgraph({
      focus,
      depth,
      expandedIds: new Set(expanded),
      claims,
      visibleTypes: new Set(DEFAULT_VISIBLE_TYPES),
    });

  it("David at depth 2 yields a readable neighborhood", () => {
    const g = run("david_994");
    expect(g.nodes.size).toBeGreaterThan(20);
    expect(g.nodes.size).toBeLessThan(120);
    expect(g.nodes.has("jesse_903")).toBe(true); // father
    expect(g.nodes.has("solomon_2762")).toBe(true); // son
    expect(g.nodes.has("obed_2228")).toBe(true); // grandfather
    expect(g.nodes.has("abraham_58")).toBe(false); // far ancestor stays out
  });

  it("Job floats alone", () => {
    const g = run("job_1639");
    expect(g.nodes.size).toBe(1);
    expect(g.edges).toHaveLength(0);
  });

  it("Joseph shows both conflicting father edges", () => {
    const g = run("joseph_1715", 1);
    const conflict = g.edges.filter((e) => e.conflictGroup === "cg_joseph-father");
    expect(conflict).toHaveLength(2);
    expect(g.nodes.has("jacob_683")).toBe(true);
    expect(g.nodes.has("heli_1484")).toBe(true);
  });

  it("expansion pulls the frontier outward", () => {
    const before = run("david_994");
    // Jesse's ancestors beyond depth 2 hidden behind a badge.
    expect(before.frontier.has("obed_2228")).toBe(true);
    const after = run("david_994", 2, ["obed_2228"]);
    expect(after.nodes.has("boaz_519")).toBe(true); // Boaz enters via expansion
  });

  it("stays performant on the largest hubs", () => {
    const t0 = performance.now();
    for (const focus of ["israel_682", "abraham_58", "david_994", "jesus_905"]) {
      run(focus, 3);
    }
    expect(performance.now() - t0).toBeLessThan(500);
  });
});
