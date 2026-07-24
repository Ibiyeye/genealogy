import { useStore } from "../store.js";

export function AboutView(): React.ReactElement {
  const dataset = useStore((s) => s.dataset)!;
  return (
    <div className="about-page">
      <header className="page-head">
        <h1>About Biblekin</h1>
      </header>
      <p>
        A genealogy of notable biblical figures. Every relationship is a
        sourced claim with verse citations; where the sources genuinely differ
        — Matthew 1 and Luke 3 give Joseph different fathers, the Septuagint
        adds a second Cainan, Chronicles and Matthew name different fathers
        for Zerubbabel — the competing readings are shown side by side with
        attribution, never silently resolved.
      </p>
      <p>
        Dotted or flagged steps mean the text itself skips generations:
        “son of” in a biblical genealogy can mean grandson or descendant.
        Dates shown are estimates; the text only states relative anchors
        (lifespans, ages at fatherhood, regnal years), which appear on each
        person's page.
      </p>
      <h2>Data &amp; license</h2>
      <p>
        Derived from{" "}
        <a href="https://github.com/robertrouse/theographic-bible-metadata" target="_blank" rel="noreferrer">
          Theographic Bible Metadata
        </a>{" "}
        by Robert Rouse (<a href="https://viz.bible" target="_blank" rel="noreferrer">Viz.Bible</a>),
        used and re-published under{" "}
        <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">
          CC BY-SA 4.0
        </a>
        , with hand-curated conflict groups, typed relationships, name
        variants, lineage definitions, and chronology data added. Source code
        and curation files:{" "}
        <a href="https://github.com/Ibiyeye/genealogy" target="_blank" rel="noreferrer">
          github.com/Ibiyeye/genealogy
        </a>
        .
      </p>
      <p className="footer-meta">
        Dataset {dataset.manifest.datasetVersion} ·{" "}
        {dataset.manifest.counts.persons.toLocaleString()} people ·{" "}
        {dataset.manifest.counts.claims.toLocaleString()} claims ·{" "}
        {dataset.manifest.counts.conflictGroups} conflict groups
      </p>
    </div>
  );
}
