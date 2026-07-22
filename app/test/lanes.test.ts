import { describe, expect, it } from "vitest";
import { packLanes } from "../src/timeline/lanes.js";

describe("packLanes", () => {
  it("reuses lanes for non-overlapping bars", () => {
    const r = packLanes([
      { id: "a", start: -1000, end: -900 },
      { id: "b", start: -880, end: -800 }, // fits after a (gap 8 ok: -900+8 <= -880)
      { id: "c", start: -950, end: -850 }, // overlaps a → new lane
    ]);
    expect(r.lanes.get("a")).toBe(0);
    expect(r.lanes.get("b")).toBe(0);
    expect(r.lanes.get("c")).toBe(1);
    expect(r.laneCount).toBe(2);
  });

  it("respects the gap", () => {
    const r = packLanes([
      { id: "a", start: -1000, end: -900 },
      { id: "b", start: -898, end: -800 }, // only 2 years after a → too tight
    ]);
    expect(r.lanes.get("b")).toBe(1);
  });

  it("handles hundreds of overlapping items", () => {
    const items = Array.from({ length: 500 }, (_, i) => ({
      id: `p${i}`,
      start: -2000 + (i % 40) * 10,
      end: -2000 + (i % 40) * 10 + 120,
    }));
    const r = packLanes(items);
    expect(r.laneCount).toBeGreaterThan(1);
    expect(r.lanes.size).toBe(500);
  });
});
