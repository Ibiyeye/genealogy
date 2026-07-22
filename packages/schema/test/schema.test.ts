import { describe, expect, it } from "vitest";
import {
  ClaimSchema,
  PersonSchema,
  ChronologyLayerSchema,
  AnchorSchema,
  isValidVerseRef,
  verseRefSortKey,
} from "../src/index.js";

describe("Claim schema", () => {
  const josephConflict = [
    {
      id: "clm_joseph-father-jacob",
      type: "parent_of",
      from: "jacob_matt1",
      to: "joseph_husband_of_mary",
      citations: ["Matt 1:16"],
      source: { tradition: "NT", document: "Matthean genealogy" },
      confidence: "explicit",
      conflictGroup: "cg_joseph-father",
    },
    {
      id: "clm_joseph-father-heli",
      type: "parent_of",
      from: "heli_luke3",
      to: "joseph_husband_of_mary",
      citations: ["Luke 3:23"],
      source: { tradition: "NT", document: "Lukan genealogy" },
      confidence: "explicit",
      conflictGroup: "cg_joseph-father",
      note: "Possibly Mary's line or levirate; unresolved by design.",
    },
  ];

  it("round-trips the Joseph competing-claim example", () => {
    for (const raw of josephConflict) {
      const parsed = ClaimSchema.parse(raw);
      expect(parsed).toMatchObject(raw);
      // parse(parse(x)) is stable
      expect(ClaimSchema.parse(parsed)).toEqual(parsed);
    }
  });

  it("rejects an explicit claim with no citations", () => {
    const bad = {
      id: "clm_bad",
      type: "parent_of",
      from: "a",
      to: "b",
      citations: [],
      source: { tradition: "MT" },
      confidence: "explicit",
    };
    expect(() => ClaimSchema.parse(bad)).toThrow(/citations required/);
  });

  it("allows traditional and inferred claims without citations", () => {
    for (const confidence of ["traditional", "inferred"] as const) {
      const claim = ClaimSchema.parse({
        id: `clm_${confidence}`,
        type: "ancestor_of",
        from: "a",
        to: "b",
        citations: [],
        source: { tradition: "curated", document: "chain contraction" },
        confidence,
      });
      expect(claim.confidence).toBe(confidence);
    }
  });

  it("rejects self-referencing claims", () => {
    expect(() =>
      ClaimSchema.parse({
        id: "clm_self",
        type: "spouse_of",
        from: "a",
        to: "a",
        citations: ["Gen 1:1"],
        source: { tradition: "MT" },
        confidence: "explicit",
      }),
    ).toThrow(/from and to must differ/);
  });
});

describe("Person schema", () => {
  it("parses a person with renamed variant", () => {
    const jacob = PersonSchema.parse({
      id: "jacob_1732",
      primaryName: "Jacob",
      variants: [{ name: "Israel", kind: "renamed", citations: ["Gen 32:28"] }],
      gender: "male",
      citations: ["Gen 25:26"],
      verseCount: 358,
      sourceIds: { theographic: "recABC" },
    });
    expect(jacob.variants[0]?.name).toBe("Israel");
  });
});

describe("Chronology schemas", () => {
  it("parses a layer with mixed span kinds", () => {
    const layer = ChronologyLayerSchema.parse({
      id: "ussher",
      label: "Ussher (1650)",
      attribution: "James Ussher, Annales Veteris Testamenti",
      spans: {
        adam_1: { birth: -4004, death: -3074, approx: false },
        job_1: { active: [-2100, -1900], approx: true },
      },
    });
    expect(layer.spans["adam_1"]?.birth).toBe(-4004);
  });

  it("rejects an empty span", () => {
    expect(() =>
      ChronologyLayerSchema.parse({
        id: "x",
        label: "x",
        attribution: "x",
        spans: { someone: { approx: true } },
      }),
    ).toThrow();
  });

  it("parses an age_at_fatherhood anchor", () => {
    const anchor = AnchorSchema.parse({
      kind: "age_at_fatherhood",
      parent: "adam_1",
      child: "seth_130",
      age: 130,
      citations: ["Gen 5:3"],
    });
    expect(anchor.kind).toBe("age_at_fatherhood");
  });
});

describe("verse refs", () => {
  it("validates canonical refs", () => {
    expect(isValidVerseRef("Gen 5:3")).toBe(true);
    expect(isValidVerseRef("1Chr 3:19")).toBe(true);
    expect(isValidVerseRef("Luke 3:23")).toBe(true);
    expect(isValidVerseRef("Ps 23")).toBe(true);
    expect(isValidVerseRef("Gen 5:3-5")).toBe(true);
  });
  it("rejects unknown books and malformed refs", () => {
    expect(isValidVerseRef("Genesis 5:3")).toBe(false);
    expect(isValidVerseRef("Tob 1:1")).toBe(false);
    expect(isValidVerseRef("Gen5:3")).toBe(false);
  });
  it("sorts refs canonically", () => {
    const refs = ["Luke 3:23", "Gen 5:3", "1Chr 3:19", "Gen 5:1"];
    refs.sort((a, b) => verseRefSortKey(a) - verseRefSortKey(b));
    expect(refs).toEqual(["Gen 5:1", "Gen 5:3", "1Chr 3:19", "Luke 3:23"]);
  });
});
