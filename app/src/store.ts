import { create } from "zustand";
import type { ChronologyLayer, ClaimType, PersonId } from "@genealogy/schema";
import type { Dataset } from "./data/loadDataset.js";
import { loadChronologyLayer } from "./data/loadDataset.js";

/** Claim types shown by default; the rest sit behind filter chips. */
export const DEFAULT_VISIBLE_TYPES: ClaimType[] = [
  "parent_of",
  "ancestor_of",
  "spouse_of",
  "concubine_of",
];

export const ALL_CLAIM_TYPES: ClaimType[] = [
  "parent_of",
  "ancestor_of",
  "spouse_of",
  "concubine_of",
  "adopted_by",
  "succeeded_by",
  "mentored_by",
  "contemporary_of",
  "sibling_of",
];

interface AppState {
  dataset: Dataset | null;
  loadError: string | null;

  focusId: PersonId | null;
  selectedId: PersonId | null;
  expandedIds: ReadonlySet<PersonId>;
  generationDepth: number;
  breadcrumbs: PersonId[];

  chronologyLayerId: string;
  layers: Record<string, ChronologyLayer>;

  visibleClaimTypes: ReadonlySet<ClaimType>;

  setDataset(dataset: Dataset): void;
  setLoadError(message: string): void;
  select(id: PersonId | null): void;
  /** Focus recenters the graph; selection follows. */
  focus(id: PersonId): void;
  expand(id: PersonId): void;
  resetExpansion(): void;
  setGenerationDepth(depth: number): void;
  setChronologyLayer(id: string): Promise<void>;
  toggleClaimType(type: ClaimType): void;
  registerLayer(layer: ChronologyLayer): void;
}

export const useStore = create<AppState>((set, get) => ({
  dataset: null,
  loadError: null,
  focusId: null,
  selectedId: null,
  expandedIds: new Set<PersonId>(),
  generationDepth: 2,
  breadcrumbs: [],
  chronologyLayerId: "theographic",
  layers: {},
  visibleClaimTypes: new Set(DEFAULT_VISIBLE_TYPES),

  setDataset: (dataset) => set({ dataset }),
  setLoadError: (loadError) => set({ loadError }),

  select: (id) => set({ selectedId: id }),

  focus: (id) => {
    const { focusId, breadcrumbs } = get();
    const crumbs =
      focusId && focusId !== id
        ? [...breadcrumbs.filter((b) => b !== focusId && b !== id), focusId].slice(-6)
        : breadcrumbs.filter((b) => b !== id);
    set({
      focusId: id,
      selectedId: id,
      breadcrumbs: crumbs,
      expandedIds: new Set<PersonId>(),
    });
  },

  expand: (id) => {
    const next = new Set(get().expandedIds);
    next.add(id);
    set({ expandedIds: next });
  },

  resetExpansion: () => set({ expandedIds: new Set<PersonId>() }),

  setGenerationDepth: (depth) =>
    set({ generationDepth: Math.min(3, Math.max(1, depth)) }),

  setChronologyLayer: async (id) => {
    const { layers, dataset } = get();
    if (!layers[id]) {
      const meta = dataset?.manifest.chronologyLayers.find((l) => l.id === id);
      if (!meta) return;
      const layer = await loadChronologyLayer(meta.file);
      set((s) => ({ layers: { ...s.layers, [id]: layer } }));
    }
    set({ chronologyLayerId: id });
  },

  toggleClaimType: (type) => {
    const next = new Set(get().visibleClaimTypes);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    set({ visibleClaimTypes: next });
  },

  registerLayer: (layer) =>
    set((s) => ({ layers: { ...s.layers, [layer.id]: layer } })),
}));
