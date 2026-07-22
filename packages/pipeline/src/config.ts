import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..", "..");

export const PIPELINE_CONFIG = {
  /** Include anyone mentioned in at least this many verses. */
  verseCountThreshold: 10,
  /** Max key citations kept per person (plus first mention). */
  maxCitationsPerPerson: 8,
  /** Thresholds reported by the CLI to help tune the filter. */
  reportThresholds: [5, 10, 15, 20],
  paths: {
    root,
    curation: join(root, "data", "curation"),
    outDir: join(root, "app", "public", "data"),
    reports: join(here, "..", "reports"),
  },
} as const;
