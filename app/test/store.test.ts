import { describe, expect, it } from "vitest";
import { parseHash, routeToHash, type Route } from "../src/store.js";

describe("hash routing", () => {
  it("parses all route forms", () => {
    expect(parseHash("")).toEqual({ name: "home" });
    expect(parseHash("#/")).toEqual({ name: "home" });
    expect(parseHash("#/line/kings-of-judah")).toEqual({ name: "lineage", id: "kings-of-judah" });
    expect(parseHash("#/p/david_994")).toEqual({ name: "person", id: "david_994" });
    expect(parseHash("#/about")).toEqual({ name: "about" });
    expect(parseHash("#/garbage/x")).toEqual({ name: "home" });
  });

  it("round-trips every route", () => {
    const routes: Route[] = [
      { name: "home" },
      { name: "lineage", id: "the-patriarchs" },
      { name: "person", id: "israel_682" },
      { name: "about" },
    ];
    for (const r of routes) {
      expect(parseHash(routeToHash(r))).toEqual(r);
    }
  });
});
