import { create } from "zustand";
import type { Dataset } from "./data/loadDataset.js";

/**
 * Hash-based routing so the browser back button works everywhere
 * (including as an installed mobile web app):
 *   #/            home
 *   #/line/<id>   lineage view
 *   #/p/<id>      person view
 *   #/about       about page
 */
export type Route =
  | { name: "home" }
  | { name: "lineage"; id: string }
  | { name: "person"; id: string }
  | { name: "about" };

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (parts[0] === "line" && parts[1]) return { name: "lineage", id: parts[1] };
  if (parts[0] === "p" && parts[1]) return { name: "person", id: parts[1] };
  if (parts[0] === "about") return { name: "about" };
  return { name: "home" };
}

export function routeToHash(route: Route): string {
  switch (route.name) {
    case "home":
      return "#/";
    case "lineage":
      return `#/line/${route.id}`;
    case "person":
      return `#/p/${route.id}`;
    case "about":
      return "#/about";
  }
}

interface AppState {
  dataset: Dataset | null;
  loadError: string | null;
  route: Route;
  searchOpen: boolean;

  setDataset(dataset: Dataset): void;
  setLoadError(message: string): void;
  /** Push a new route (adds a history entry; back button returns). */
  navigate(route: Route): void;
  /** Called by the hashchange listener — sync only, no push. */
  syncRoute(route: Route): void;
  openSearch(open: boolean): void;
}

export const useStore = create<AppState>((set) => ({
  dataset: null,
  loadError: null,
  route: parseHash(typeof window !== "undefined" ? window.location.hash : ""),
  searchOpen: false,

  setDataset: (dataset) => set({ dataset }),
  setLoadError: (loadError) => set({ loadError }),

  navigate: (route) => {
    const hash = routeToHash(route);
    if (window.location.hash !== hash) {
      window.location.hash = hash; // fires hashchange → syncRoute
    }
    set({ route, searchOpen: false });
    window.scrollTo({ top: 0 });
  },

  syncRoute: (route) => {
    set({ route, searchOpen: false });
    window.scrollTo({ top: 0 });
  },

  openSearch: (open) => set({ searchOpen: open }),
}));

if (typeof window !== "undefined") {
  window.addEventListener("hashchange", () => {
    useStore.getState().syncRoute(parseHash(window.location.hash));
  });
}
