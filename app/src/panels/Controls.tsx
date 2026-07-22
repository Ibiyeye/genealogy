import { useState } from "react";
import type { ClaimType } from "@genealogy/schema";
import { ALL_CLAIM_TYPES, useStore } from "../store.js";

const TYPE_LABELS: Record<ClaimType, string> = {
  parent_of: "lineage",
  ancestor_of: "skipped gens",
  spouse_of: "marriage",
  concubine_of: "concubinage",
  adopted_by: "adoption",
  succeeded_by: "succession",
  mentored_by: "mentorship",
  contemporary_of: "contemporaries",
  sibling_of: "siblings",
};

export function ChronologyToggle(): React.ReactElement | null {
  const dataset = useStore((s) => s.dataset);
  const chronologyLayerId = useStore((s) => s.chronologyLayerId);
  const setChronologyLayer = useStore((s) => s.setChronologyLayer);
  if (!dataset) return null;
  const layers = dataset.manifest.chronologyLayers;
  const active = layers.find((l) => l.id === chronologyLayerId);
  return (
    <div className="chronology-toggle">
      <div className="segmented" role="radiogroup" aria-label="Chronology system">
        {layers.map((layer) => (
          <button
            key={layer.id}
            role="radio"
            aria-checked={layer.id === chronologyLayerId}
            className={layer.id === chronologyLayerId ? "seg active" : "seg"}
            title={`${layer.attribution} — dates for ${layer.coverage} people`}
            onClick={() => void setChronologyLayer(layer.id)}
          >
            {layer.label}
          </button>
        ))}
      </div>
      {active && (
        <div className="layer-attribution" title={active.attribution}>
          {active.attribution} · {active.coverage} dated
        </div>
      )}
    </div>
  );
}

export function ClaimTypeChips(): React.ReactElement {
  const visibleClaimTypes = useStore((s) => s.visibleClaimTypes);
  const toggleClaimType = useStore((s) => s.toggleClaimType);
  return (
    <div className="claim-chips" aria-label="Relationship types shown in the graph">
      {ALL_CLAIM_TYPES.map((type) => (
        <button
          key={type}
          className={visibleClaimTypes.has(type) ? "chip on" : "chip"}
          onClick={() => toggleClaimType(type)}
          aria-pressed={visibleClaimTypes.has(type)}
        >
          {TYPE_LABELS[type]}
        </button>
      ))}
    </div>
  );
}

export function AboutButton(): React.ReactElement {
  const [open, setOpen] = useState(false);
  const dataset = useStore((s) => s.dataset);
  return (
    <>
      <button className="about-button" onClick={() => setOpen(true)}>
        About
      </button>
      {open && dataset && (
        <div className="about-overlay" onClick={() => setOpen(false)}>
          <div className="about-dialog" onClick={(e) => e.stopPropagation()}>
            <h2>About this explorer</h2>
            <p>
              An interactive genealogy and timeline of notable biblical figures.
              Every relationship is a sourced claim with verse citations; where
              the sources genuinely differ (Matthew 1 vs Luke 3 on Joseph's
              father; the Septuagint's second Cainan), competing claims are
              shown side by side with attribution rather than silently resolved.
            </p>
            <p>
              Absolute dates are a swappable layer — the text itself only states
              relative anchors (lifespans, ages at fatherhood, regnal years),
              which appear in each person's panel. Dating systems disagree by
              centuries, especially before 1000 BC.
            </p>
            <h3>Data &amp; license</h3>
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
              variants, and chronology layers added.
            </p>
            <p className="about-meta">
              Dataset {dataset.manifest.datasetVersion} ·{" "}
              {dataset.manifest.counts.persons.toLocaleString()} people ·{" "}
              {dataset.manifest.counts.claims.toLocaleString()} claims ·{" "}
              {dataset.manifest.counts.conflictGroups} conflict groups ·{" "}
              {dataset.manifest.counts.anchors} anchors
            </p>
            <button className="about-close" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
