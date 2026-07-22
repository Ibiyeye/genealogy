/**
 * Loaders for the hand-edited YAML files under data/curation/.
 * Each loader validates with zod and fails loudly — curation files are code.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import { BOOK_CODES } from "@genealogy/schema";
import type { GenealogyChapterSpec } from "./notability.js";
import { PIPELINE_CONFIG } from "./config.js";

const ChapterEntry = z.union([
  z.number().int().positive(),
  z.string().regex(/^\d+-\d+$/),
]);
const GenealogyChaptersFile = z.record(z.string(), z.array(ChapterEntry));

export function loadGenealogyChapters(
  dir: string = PIPELINE_CONFIG.paths.curation,
): GenealogyChapterSpec {
  const raw = parse(readFileSync(join(dir, "genealogy-chapters.yaml"), "utf8"));
  const parsed = GenealogyChaptersFile.parse(raw);
  const spec: GenealogyChapterSpec = {};
  const validBooks = new Set<string>(BOOK_CODES);
  for (const [book, entries] of Object.entries(parsed)) {
    if (!validBooks.has(book)) {
      throw new Error(`genealogy-chapters.yaml: unknown book code "${book}"`);
    }
    spec[book] = entries.map((e) => {
      if (typeof e === "number") return [e, e] as [number, number];
      const [lo, hi] = e.split("-").map(Number);
      if (lo === undefined || hi === undefined || lo > hi) {
        throw new Error(`genealogy-chapters.yaml: bad range "${e}" in ${book}`);
      }
      return [lo, hi] as [number, number];
    });
  }
  return spec;
}

const NotabilityFile = z.object({
  include: z.array(z.string()).default([]),
  exclude: z.array(z.string()).default([]),
});

export function loadNotabilityOverrides(
  dir: string = PIPELINE_CONFIG.paths.curation,
): { include: Set<string>; exclude: Set<string> } {
  const path = join(dir, "notability.yaml");
  if (!existsSync(path)) return { include: new Set(), exclude: new Set() };
  const parsed = NotabilityFile.parse(parse(readFileSync(path, "utf8")) ?? {});
  return { include: new Set(parsed.include), exclude: new Set(parsed.exclude) };
}
