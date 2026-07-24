/**
 * Asserts on the actually-emitted artifacts in app/public/data — run after
 * `pnpm build:data`. Validates budget, conflict cards, and spot people.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PersonsArtifactSchema,
  ClaimsArtifactSchema,
  ManifestSchema,
  ChronologyArtifactSchema,
} from "@genealogy/schema";
import { PIPELINE_CONFIG } from "../src/config.js";

const outDir = PIPELINE_CONFIG.paths.outDir;
const built = existsSync(join(outDir, "manifest.json"));

describe.skipIf(!built)("emitted artifacts", () => {
  const read = (name: string): unknown =>
    JSON.parse(readFileSync(join(outDir, name), "utf8"));

  it("all artifacts parse against their schemas", () => {
    const persons = PersonsArtifactSchema.parse(read("persons.json"));
    const claims = ClaimsArtifactSchema.parse(read("claims.json"));
    const manifest = ManifestSchema.parse(read("manifest.json"));
    ChronologyArtifactSchema.parse(read("chronology.theographic.json"));
    ChronologyArtifactSchema.parse(read("chronology.ussher.json"));
    expect(manifest.counts.persons).toBe(persons.persons.length);
    expect(manifest.counts.claims).toBe(claims.claims.length);
  });

  it("includes every named person, not a notable subset", () => {
    const { persons } = PersonsArtifactSchema.parse(read("persons.json"));
    expect(persons.length).toBeGreaterThan(3000);
    const ids = new Set(persons.map((p) => p.id));
    // Abel appears in only 9 verses — the old threshold of 10 dropped him.
    expect(ids.has("abel_13")).toBe(true);
  });

  it("Adam has all three named sons", () => {
    const { claims } = ClaimsArtifactSchema.parse(read("claims.json"));
    const { persons } = PersonsArtifactSchema.parse(read("persons.json"));
    const byId = new Map(persons.map((p) => [p.id, p]));
    const sons = claims
      .filter((c) => c.type === "parent_of" && c.from === "adam_78")
      .map((c) => byId.get(c.to)?.primaryName)
      .sort();
    expect(sons).toEqual(["Abel", "Cain", "Seth"]);
  });

  it("total payload stays within budget", () => {
    const files = [
      "persons.json",
      "claims.json",
      "chronology.theographic.json",
      "chronology.ussher.json",
      "anchors.json",
      "search-index.json",
      "manifest.json",
    ];
    const total = files.reduce(
      (sum, f) => sum + readFileSync(join(outDir, f)).length,
      0,
    );
    // Raw budget; gzip over the wire is roughly a fifth of this.
    expect(total).toBeLessThan(2.5 * 1024 * 1024);
  });

  it("David, Job, and Melchizedek are present; Job floats", () => {
    const { persons } = PersonsArtifactSchema.parse(read("persons.json"));
    const { claims } = ClaimsArtifactSchema.parse(read("claims.json"));
    const ids = new Set(persons.map((p) => p.id));
    expect(ids.has("david_994")).toBe(true);
    expect(ids.has("job_1639")).toBe(true);
    expect(ids.has("melchisedec_1991")).toBe(true);
    const melchizedek = persons.find((p) => p.id === "melchisedec_1991")!;
    expect(melchizedek.primaryName).toBe("Melchizedek");
  });

  it("collections emit as groups with their curated members", () => {
    const lineages = (read("lineages.json") as { lineages: Array<{ id: string; kind: string; people: unknown[] }> }).lineages;
    const apostles = lineages.find((l) => l.id === "the-apostles")!;
    expect(apostles.kind).toBe("group");
    expect(apostles.people).toHaveLength(12);
    const tribes = lineages.find((l) => l.id === "twelve-tribes")!;
    expect(tribes.people).toHaveLength(12);
    // Descent lines stay chains.
    expect(lineages.find((l) => l.id === "kings-of-judah")!.kind).toBe("chain");
  });

  it("Joseph's father is a two-claim conflict group", () => {
    const { claims } = ClaimsArtifactSchema.parse(read("claims.json"));
    const group = claims.filter((c) => c.conflictGroup === "cg_joseph-father");
    expect(group).toHaveLength(2);
    expect(group.map((c) => c.from).sort()).toEqual(["heli_1484", "jacob_683"]);
    expect(group.every((c) => c.to === "joseph_1715")).toBe(true);
    // The pre-resolved import edge is gone.
    expect(claims.some((c) => c.id === "thg_parent_jacob_683_joseph_1715")).toBe(false);
  });

  it("Cainan conflict carries MT vs LXX attribution", () => {
    const { claims } = ClaimsArtifactSchema.parse(read("claims.json"));
    const group = claims.filter((c) => c.conflictGroup === "cg_salah-father");
    expect(group.map((c) => c.source.tradition).sort()).toEqual(["LXX", "MT"]);
  });

  it("Jacob carries the Israel variant with citation", () => {
    const { persons } = PersonsArtifactSchema.parse(read("persons.json"));
    const jacob = persons.find((p) => p.id === "israel_682")!;
    expect(jacob.primaryName).toBe("Jacob");
    const israel = jacob.variants.find((v) => v.name === "Israel");
    expect(israel).toMatchObject({ kind: "renamed" });
    expect(israel!.citations).toContain("Gen 32:28");
  });

  it("Ussher layer places Adam at -4004", () => {
    const ussher = ChronologyArtifactSchema.parse(read("chronology.ussher.json"));
    expect(ussher.spans["adam_78"]).toMatchObject({ birth: -4004, death: -3074 });
  });

  it("default layer covers nearly everyone", () => {
    const { persons } = PersonsArtifactSchema.parse(read("persons.json"));
    const layer = ChronologyArtifactSchema.parse(read("chronology.theographic.json"));
    const covered = persons.filter((p) => layer.spans[p.id]).length;
    expect(covered / persons.length).toBeGreaterThan(0.9);
  });
});
