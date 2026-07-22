import { describe, expect, it } from "vitest";
import { ingest } from "../src/ingest.js";
import { buildVerseResolver, selectCitations } from "../src/verses.js";
import { applyNotability, inGenealogyChapter } from "../src/notability.js";
import type { TheoPerson, TheoVerse } from "../src/theographic.js";

/** Minimal Airtable-shaped person record. */
function tp(
  recId: string,
  slug: string,
  name: string,
  fields: Partial<TheoPerson["fields"]> = {},
): TheoPerson {
  return {
    id: recId,
    fields: {
      personLookup: slug,
      name,
      verseCount: 1,
      gender: "Male",
      ...fields,
    },
  };
}

// A: patriarch (notable) → B: obscure → C: obscure → D: king (notable)
// E: spouse of A. F: floating (Job-like, notable). G: below threshold, but
// mentioned in a genealogy chapter.
const fixture: TheoPerson[] = [
  tp("recA", "alpha_1", "Alpha", { verseCount: 50, children: ["recB"], partners: ["recE"] }),
  tp("recB", "beta_2", "Beta", { verseCount: 2, father: ["recA"], children: ["recC"] }),
  tp("recC", "gamma_3", "Gamma", { verseCount: 1, father: ["recB"], children: ["recD"] }),
  tp("recD", "delta_4", "Delta", { verseCount: 40, father: ["recC"] }),
  tp("recE", "eve_5", "Eve", { verseCount: 30, gender: "Female", partners: ["recA"] }),
  tp("recF", "floater_6", "Floater", { verseCount: 25 }),
  tp("recG", "genlist_7", "Genlist", { verseCount: 1, verses: ["v1"] }),
];

const verses: TheoVerse[] = [
  { id: "v1", fields: { osisRef: "Gen.5.3" } },
  { id: "v2", fields: { osisRef: "Matt.1.16" } },
  { id: "v3", fields: { osisRef: "Bad" } },
];

describe("ingest", () => {
  const result = ingest(fixture);

  it("maps records to slug ids", () => {
    expect([...result.persons.keys()].sort()).toEqual([
      "alpha_1", "beta_2", "delta_4", "eve_5", "floater_6", "gamma_3", "genlist_7",
    ]);
  });

  it("creates parent_of claims from father[]", () => {
    const parents = result.claims.filter((c) => c.type === "parent_of");
    expect(parents.map((c) => `${c.from}>${c.to}`).sort()).toEqual([
      "alpha_1>beta_2", "beta_2>gamma_3", "gamma_3>delta_4",
    ]);
  });

  it("dedupes symmetric spouse claims", () => {
    const spouses = result.claims.filter((c) => c.type === "spouse_of");
    expect(spouses).toHaveLength(1);
    expect(spouses[0]!.from < spouses[0]!.to).toBe(true);
  });

  it("does not flag reciprocal children[] as anomalies", () => {
    // recA.children=[recB] and recB.father=[recA] are reciprocal.
    expect(
      result.anomalies.filter((a) => a.includes("lacks reciprocal")),
    ).toHaveLength(0);
  });

  it("drops lowercase common-noun alsoCalled values, keeps real variants", () => {
    const r = ingest([
      tp("rec1", "mary_1", "Mary", { alsoCalled: "mother" }),
      tp("rec2", "josiah_1", "Josiah", { alsoCalled: "hen,Hen" }),
    ]);
    expect(r.persons.get("mary_1")!.variants).toHaveLength(0);
    expect(r.persons.get("josiah_1")!.variants.map((v) => v.name)).toEqual(["Hen"]);
  });

  it("derives names and disambiguators from displayTitle patterns", () => {
    const r = ingest([
      tp("rec1", "mary_1", "Mary", { displayTitle: "Mary (mother of Jesus)" }),
      tp("rec2", "mary_2", "Mary", { displayTitle: "Mary Magdalene", alsoCalled: "Magdalene" }),
      tp("rec3", "israel_3", "Israel", { displayTitle: "Jacob (Israel)", alsoCalled: "Israel" }),
    ]);
    expect(r.persons.get("mary_1")).toMatchObject({
      primaryName: "Mary",
      disambiguator: "mother of Jesus",
    });
    expect(r.persons.get("mary_2")).toMatchObject({
      primaryName: "Mary",
      disambiguator: "Magdalene",
    });
    const jacob = r.persons.get("israel_3")!;
    expect(jacob.primaryName).toBe("Jacob");
    expect(jacob.disambiguator).toBeUndefined();
    expect(jacob.variants.map((v) => v.name)).toEqual(["Israel"]);
  });

  it("adds claim + anomaly for one-sided children[]", () => {
    const oneSided = ingest([
      tp("recX", "x_1", "X", { children: ["recY"] }),
      tp("recY", "y_2", "Y", {}), // no father back-link
    ]);
    expect(oneSided.anomalies.some((a) => a.includes("lacks reciprocal"))).toBe(true);
    expect(
      oneSided.claims.some((c) => c.type === "parent_of" && c.from === "x_1" && c.to === "y_2"),
    ).toBe(true);
  });
});

describe("verse resolution", () => {
  const resolver = buildVerseResolver(verses);

  it("resolves osisRefs to compact refs", () => {
    expect(resolver.resolve("v1")).toBe("Gen 5:3");
    expect(resolver.resolve("v2")).toBe("Matt 1:16");
  });

  it("logs anomalies for unparseable refs", () => {
    expect(resolver.resolve("v3")).toBeUndefined();
    expect(resolver.anomalies).toHaveLength(1);
  });

  it("selectCitations prefers book spread, keeps canonical order", () => {
    const picked = selectCitations(
      ["Gen 1:1", "Gen 1:2", "Gen 2:1", "Matt 1:1", "Luke 3:1"],
      3,
    );
    expect(picked).toEqual(["Gen 1:1", "Matt 1:1", "Luke 3:1"]);
  });
});

describe("notability + chain contraction", () => {
  const ingested = ingest(fixture);
  const resolver = buildVerseResolver(verses);
  const fullRefs = new Map<string, string[]>();
  for (const [id, extras] of ingested.raw) {
    fullRefs.set(
      id,
      extras.verseRecIds
        .map((r) => resolver.resolve(r))
        .filter((r): r is string => r !== undefined),
    );
  }

  const run = (overrides: Partial<Parameters<typeof applyNotability>[0]> = {}) =>
    applyNotability({
      persons: ingested.persons,
      claims: ingested.claims,
      fullRefs,
      genealogyChapters: { Gen: [[5, 5]] },
      verseCountThreshold: 10,
      forceInclude: new Set(),
      forceExclude: new Set(),
      ...overrides,
    });

  it("includes by verseCount, genealogy chapter, and excludes the rest", () => {
    const r = run();
    expect([...r.included].sort()).toEqual([
      "alpha_1", "delta_4", "eve_5", "floater_6", "genlist_7",
    ]);
    expect(r.reasons.get("genlist_7")).toBe("genealogyChapter");
    expect(r.reasons.get("alpha_1")).toBe("verseCount");
  });

  it("contracts lineage chains through excluded people", () => {
    const r = run();
    const contraction = r.claims.find((c) => c.type === "ancestor_of");
    expect(contraction).toBeDefined();
    expect(contraction!.from).toBe("alpha_1");
    expect(contraction!.to).toBe("delta_4");
    expect(contraction!.telescoped).toBe(true);
    expect(contraction!.note).toContain("Beta");
    expect(contraction!.note).toContain("Gamma");
    // No dangling claims survive.
    for (const c of r.claims) {
      expect(r.included.has(c.from)).toBe(true);
      expect(r.included.has(c.to)).toBe(true);
    }
  });

  it("does not contract when the intermediate is included", () => {
    const r = run({ forceInclude: new Set(["beta_2", "gamma_3"]) });
    expect(r.claims.filter((c) => c.type === "ancestor_of")).toHaveLength(0);
    // Direct chain survives intact.
    expect(r.claims.filter((c) => c.type === "parent_of")).toHaveLength(3);
  });

  it("respects force-exclude", () => {
    const r = run({ forceExclude: new Set(["floater_6"]) });
    expect(r.included.has("floater_6")).toBe(false);
  });

  it("keeps floating people with no claims", () => {
    const r = run();
    expect(r.included.has("floater_6")).toBe(true);
    expect(r.claims.some((c) => c.from === "floater_6" || c.to === "floater_6")).toBe(false);
  });

  it("inGenealogyChapter handles ranges", () => {
    expect(inGenealogyChapter(["1Chr 7:2"], { "1Chr": [[1, 9]] })).toBe(true);
    expect(inGenealogyChapter(["1Chr 12:2"], { "1Chr": [[1, 9]] })).toBe(false);
  });
});
