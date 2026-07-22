/**
 * Pipeline orchestrator: ingest → verse resolution → notability filter →
 * overlay merge → validate → emit. Run via `pnpm build:data`.
 * `--validate-only` stops after validation without emitting.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { PersonId, VerseRef } from "@genealogy/schema";
import { PIPELINE_CONFIG } from "./config.js";
import { ingest } from "./ingest.js";
import { buildVerseResolver, selectCitations } from "./verses.js";
import { applyNotability } from "./notability.js";
import { loadGenealogyChapters, loadNotabilityOverrides } from "./curationFiles.js";
import { readVendored } from "./vendor.js";
import type { TheoPerson, TheoVerse } from "./theographic.js";

export async function runPipeline(opts: { validateOnly?: boolean } = {}): Promise<void> {
  const cfg = PIPELINE_CONFIG;
  const t0 = Date.now();

  // Stage 1 — ingest
  const theoPersons = readVendored("people.json") as TheoPerson[];
  const ingested = ingest(theoPersons);
  console.log(
    `ingest: ${ingested.persons.size} persons, ${ingested.claims.length} claims, ${ingested.anomalies.length} anomalies`,
  );

  // Stage 2 — verse resolution
  const theoVerses = readVendored("verses.json") as TheoVerse[];
  const resolver = buildVerseResolver(theoVerses);
  const fullRefs = new Map<PersonId, VerseRef[]>();
  let unresolved = 0;
  for (const [id, extras] of ingested.raw) {
    const refs: VerseRef[] = [];
    for (const recId of extras.verseRecIds) {
      const ref = resolver.resolve(recId);
      if (ref) refs.push(ref);
      else unresolved++;
    }
    fullRefs.set(id, refs);
    const person = ingested.persons.get(id)!;
    person.citations = selectCitations(refs, cfg.maxCitationsPerPerson);
  }
  console.log(
    `verses: resolver ${resolver.anomalies.length} anomalies, ${unresolved} unresolved person-verse links`,
  );

  // Stage 3 — notability filter
  const genealogyChapters = loadGenealogyChapters();
  const overrides = loadNotabilityOverrides();
  // Distribution report for threshold tuning.
  for (const threshold of cfg.reportThresholds) {
    const trial = applyNotability({
      persons: ingested.persons,
      claims: ingested.claims,
      fullRefs,
      genealogyChapters,
      verseCountThreshold: threshold,
      forceInclude: overrides.include,
      forceExclude: overrides.exclude,
    });
    const marker = threshold === cfg.verseCountThreshold ? "  ← active" : "";
    console.log(`  threshold ${String(threshold).padStart(2)}: ${trial.included.size} people${marker}`);
  }
  const filtered = applyNotability({
    persons: ingested.persons,
    claims: ingested.claims,
    fullRefs,
    genealogyChapters,
    verseCountThreshold: cfg.verseCountThreshold,
    forceInclude: overrides.include,
    forceExclude: overrides.exclude,
  });
  const byReason = new Map<string, number>();
  for (const r of filtered.reasons.values()) byReason.set(r, (byReason.get(r) ?? 0) + 1);
  console.log(
    `filter: ${filtered.included.size} included (${[...byReason].map(([k, v]) => `${k}: ${v}`).join(", ")}), ${filtered.claims.length} claims kept`,
  );

  // Anomaly report
  mkdirSync(cfg.paths.reports, { recursive: true });
  const reportPath = join(cfg.paths.reports, "anomalies.txt");
  writeFileSync(
    reportPath,
    [...ingested.anomalies, ...resolver.anomalies].join("\n") + "\n",
  );
  console.log(`anomaly report: ${reportPath}`);

  // Stages 4–6 (overlay, validate, emit)
  const { runOverlayValidateEmit } = await import("./stages456.js");
  await runOverlayValidateEmit({
    persons: ingested.persons,
    claims: filtered.claims,
    included: filtered.included,
    raw: ingested.raw,
    fullRefs,
    validateOnly: opts.validateOnly ?? false,
  });

  console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runPipeline({ validateOnly: process.argv.includes("--validate-only") }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
