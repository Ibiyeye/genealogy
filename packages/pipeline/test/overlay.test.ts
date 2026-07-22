import { describe, expect, it } from "vitest";
import type { Claim, Person } from "@genealogy/schema";
import { applyOverlay, type OverlayData } from "../src/overlay.js";
import { validate } from "../src/validate.js";

function person(id: string, extra: Partial<Person> = {}): Person {
  return {
    id,
    primaryName: id,
    variants: [],
    citations: [],
    verseCount: 1,
    groups: [],
    sourceIds: {},
    ...extra,
  };
}

function claim(id: string, from: string, to: string, extra: Partial<Claim> = {}): Claim {
  return {
    id,
    type: "parent_of",
    from,
    to,
    citations: [],
    source: { tradition: "theographic" },
    confidence: "explicit",
    ...extra,
  };
}

const emptyOverlay: OverlayData = {
  people: [],
  flatClaims: [],
  conflicts: [],
  claimPatches: [],
  chronologyLayers: [],
};

describe("applyOverlay", () => {
  const basePersons = new Map([
    ["a", person("a")],
    ["b", person("b")],
    ["c", person("c")],
  ]);
  const baseClaims = [claim("thg_1", "a", "b")];

  it("patches an existing person, merging variants by name", () => {
    const result = applyOverlay(
      new Map([["a", person("a", { variants: [{ name: "Alef", kind: "alt-spelling", citations: [] }] })]]),
      [],
      {
        ...emptyOverlay,
        people: [
          {
            id: "a",
            primaryName: "Aleph",
            variants: [{ name: "Alef", kind: "renamed", citations: ["Gen 1:1"] }],
          },
        ],
      },
    );
    const merged = result.persons.get("a")!;
    expect(merged.primaryName).toBe("Aleph");
    expect(merged.variants).toHaveLength(1);
    expect(merged.variants[0]).toMatchObject({ name: "Alef", kind: "renamed" });
  });

  it("adds a new person and tracks it", () => {
    const result = applyOverlay(basePersons, [], {
      ...emptyOverlay,
      people: [{ id: "new_1", primaryName: "New" }],
    });
    expect(result.persons.has("new_1")).toBe(true);
    expect(result.addedPeople.has("new_1")).toBe(true);
  });

  it("rejects a new person without primaryName", () => {
    expect(() =>
      applyOverlay(basePersons, [], {
        ...emptyOverlay,
        people: [{ id: "mystery" }],
      }),
    ).toThrow(/requires primaryName/);
  });

  it("retracts claims and stamps conflict groups", () => {
    const result = applyOverlay(basePersons, baseClaims, {
      ...emptyOverlay,
      conflicts: [
        {
          group: "cg_b-father",
          about: "who fathered b",
          retract: ["thg_1"],
          claims: [
            {
              id: "clm_1",
              type: "parent_of",
              from: "a",
              to: "b",
              citations: ["Matt 1:16"],
              source: { tradition: "NT" },
              confidence: "explicit",
              conflictGroup: "cg_b-father",
            },
            {
              id: "clm_2",
              type: "parent_of",
              from: "c",
              to: "b",
              citations: ["Luke 3:23"],
              source: { tradition: "NT" },
              confidence: "explicit",
              conflictGroup: "cg_b-father",
            },
          ],
        },
      ],
    });
    expect(result.claims.map((c) => c.id).sort()).toEqual(["clm_1", "clm_2"]);
    expect(result.claims.every((c) => c.conflictGroup === "cg_b-father")).toBe(true);
  });

  it("warns on retraction of unknown claim id", () => {
    const result = applyOverlay(basePersons, baseClaims, {
      ...emptyOverlay,
      conflicts: [
        {
          group: "cg_x",
          about: "x",
          retract: ["thg_nonexistent"],
          claims: [
            {
              id: "clm_a",
              type: "parent_of",
              from: "a",
              to: "b",
              citations: ["Gen 1:1"],
              source: { tradition: "MT" },
              confidence: "explicit",
              conflictGroup: "cg_x",
            },
            {
              id: "clm_b",
              type: "parent_of",
              from: "c",
              to: "b",
              citations: ["Gen 1:2"],
              source: { tradition: "MT" },
              confidence: "explicit",
              conflictGroup: "cg_x",
            },
          ],
        },
      ],
    });
    expect(result.warnings.some((w) => w.includes("thg_nonexistent"))).toBe(true);
  });

  it("patches claims in place", () => {
    const result = applyOverlay(basePersons, baseClaims, {
      ...emptyOverlay,
      claimPatches: [
        { id: "thg_1", set: { citations: ["Gen 21:2"], confidence: "explicit" } },
      ],
    });
    expect(result.claims[0]).toMatchObject({ id: "thg_1", citations: ["Gen 21:2"] });
  });

  it("throws on duplicate added claim ids", () => {
    expect(() =>
      applyOverlay(basePersons, baseClaims, {
        ...emptyOverlay,
        flatClaims: [claim("thg_1", "a", "c", { source: { tradition: "MT" }, citations: ["Gen 1:1"] })],
      }),
    ).toThrow(/duplicate claim id/);
  });
});

describe("validate", () => {
  const persons = new Map([
    ["a", person("a")],
    ["b", person("b")],
  ]);

  const base = { anchors: [], layers: [] };

  it("catches dangling person ids", () => {
    const r = validate({ persons, claims: [claim("c1", "a", "ghost")], ...base });
    expect(r.errors.some((e) => e.includes('dangling person "ghost"'))).toBe(true);
  });

  it("catches missing citations on curated explicit claims", () => {
    const r = validate({
      persons,
      claims: [claim("c1", "a", "b", { source: { tradition: "MT" } })],
      ...base,
    });
    expect(r.errors.some((e) => e.includes("citations required"))).toBe(true);
  });

  it("allows theographic imports without citations", () => {
    const r = validate({ persons, claims: [claim("c1", "a", "b")], ...base });
    expect(r.errors).toHaveLength(0);
  });

  it("catches single-member conflict groups", () => {
    const r = validate({
      persons,
      claims: [claim("c1", "a", "b", { conflictGroup: "cg_lonely" })],
      ...base,
    });
    expect(r.errors.some((e) => e.includes("cg_lonely"))).toBe(true);
  });

  it("catches ancestry cycles", () => {
    const r = validate({
      persons,
      claims: [claim("c1", "a", "b"), claim("c2", "b", "a")],
      ...base,
    });
    expect(r.errors.some((e) => e.includes("ancestry cycle"))).toBe(true);
  });

  it("catches duplicate claim ids and bad refs", () => {
    const r = validate({
      persons,
      claims: [
        claim("c1", "a", "b"),
        claim("c1", "b", "a", { type: "spouse_of" }),
        claim("c2", "a", "b", { citations: ["Genesis 5:3"], source: { tradition: "MT" } }),
      ],
      ...base,
    });
    expect(r.errors.some((e) => e.includes("duplicate claim id"))).toBe(true);
    expect(r.errors.some((e) => e.includes('invalid verse ref "Genesis 5:3"'))).toBe(true);
  });

  it("warns (not errors) on floating people", () => {
    const r = validate({ persons, claims: [], ...base });
    expect(r.errors).toHaveLength(0);
    expect(r.warnings.some((w) => w.includes("floating"))).toBe(true);
  });
});
