import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..", "..");

export const PIPELINE_CONFIG = {
  /**
   * Include anyone mentioned in at least this many verses. Set to 1 (i.e.
   * everyone named in Scripture): the card-based UI has no layout pressure,
   * and any threshold above 1 silently drops genuinely central figures —
   * Abel appears in only 9 verses.
   */
  verseCountThreshold: 1,
  /** Max key citations kept per person (plus first mention). */
  maxCitationsPerPerson: 8,
  /** Thresholds reported by the CLI to help tune the filter. */
  reportThresholds: [1, 5, 10, 15, 20] as readonly number[],
  paths: {
    root,
    curation: join(root, "data", "curation"),
    outDir: join(root, "app", "public", "data"),
    reports: join(here, "..", "reports"),
  },
} as const;
