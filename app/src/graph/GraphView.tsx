import { useEffect, useMemo, useRef, useState } from "react";
import cytoscape, { type Core, type ElementDefinition } from "cytoscape";
import elk from "cytoscape-elk";
import type { Claim } from "@genealogy/schema";
import { useStore } from "../store.js";
import { computeSubgraph } from "./subgraph.js";
import { CY_STYLE } from "./style.js";
import { GraphLegend } from "./GraphLegend.js";

cytoscape.use(elk);

const REDUCED_MOTION =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Edge types that define the vertical hierarchy. Everything else (marriage,
 *  succession, mentorship…) is drawn but deliberately EXCLUDED from the
 *  layout graph, so lateral ties can't bend the generational layers — the
 *  key to an organogram-clean result. */
const HIERARCHY_TYPES = new Set(["parent_of", "ancestor_of"]);

/** Layout isolated here so swapping engines is a one-place change. */
function runLayout(cy: Core, animate: boolean): void {
  const lateral = cy.edges().filter((e) => {
    const t = e.data("type") as string | undefined;
    return t !== undefined && !HIERARCHY_TYPES.has(t);
  });
  // ELK layered (Sugiyama) with crossing minimization, on the tree edges
  // plus badge links only.
  cy.elements().not(lateral).layout({
    name: "elk",
    // @ts-expect-error elk options aren't in the base LayoutOptions type
    elk: {
      algorithm: "layered",
      "elk.direction": "DOWN",
      "elk.layered.spacing.nodeNodeBetweenLayers": 64,
      "elk.spacing.nodeNode": 26,
      "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      "elk.layered.thoroughness": 10,
      "elk.layered.considerModelOrder.strategy": "PREFER_NODES",
    },
    animate: animate && !REDUCED_MOTION,
    animationDuration: 380,
    animationEasing: "ease-out",
    fit: true,
    padding: 44,
  }).run();
}

const BADGE_SUFFIX = "::badge";

const EDGE_VERB: Record<Claim["type"], (from: string, to: string) => string> = {
  parent_of: (f, t) => `${f} is the parent of ${t}`,
  ancestor_of: (f, t) => `${f} is an ancestor of ${t} (generations skipped)`,
  spouse_of: (f, t) => `${f} and ${t} were married`,
  concubine_of: (f, t) => `${f} was a concubine of ${t}`,
  adopted_by: (f, t) => `${f} was raised/adopted by ${t}`,
  succeeded_by: (f, t) => `${f} was succeeded by ${t}`,
  mentored_by: (f, t) => `${f} was mentored by ${t}`,
  contemporary_of: (f, t) => `${f} and ${t} were contemporaries`,
  sibling_of: (f, t) => `${f} and ${t} were siblings`,
};

interface EdgeTip {
  x: number;
  y: number;
  text: string;
  citations: string[];
  conflict: boolean;
  note?: string | undefined;
}

export function GraphView(): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const [edgeTip, setEdgeTip] = useState<EdgeTip | null>(null);

  const dataset = useStore((s) => s.dataset);
  const focusId = useStore((s) => s.focusId);
  const selectedId = useStore((s) => s.selectedId);
  const expandedIds = useStore((s) => s.expandedIds);
  const generationDepth = useStore((s) => s.generationDepth);
  const visibleClaimTypes = useStore((s) => s.visibleClaimTypes);
  const focus = useStore((s) => s.focus);
  const setGenerationDepth = useStore((s) => s.setGenerationDepth);
  const breadcrumbs = useStore((s) => s.breadcrumbs);

  const subgraph = useMemo(() => {
    if (!dataset || !focusId) return null;
    return computeSubgraph({
      focus: focusId,
      depth: generationDepth,
      expandedIds,
      claims: dataset.claims,
      visibleTypes: visibleClaimTypes,
    });
  }, [dataset, focusId, generationDepth, expandedIds, visibleClaimTypes]);

  // Mount Cytoscape once; the container is always in the DOM.
  useEffect(() => {
    if (!containerRef.current) return;
    const cy = cytoscape({
      container: containerRef.current,
      style: CY_STYLE,
      wheelSensitivity: 0.3,
      maxZoom: 2.5,
      minZoom: 0.15,
    });
    cyRef.current = cy;
    if (import.meta.env.DEV) {
      (window as unknown as { __cy?: Core }).__cy = cy;
    }

    cy.on("tap", "node", (evt) => {
      const id: string = evt.target.id();
      if (id.endsWith(BADGE_SUFFIX)) {
        useStore.getState().expand(id.slice(0, -BADGE_SUFFIX.length));
        return;
      }
      useStore.getState().select(id);
    });
    cy.on("dbltap", "node", (evt) => {
      const id: string = evt.target.id();
      if (!id.endsWith(BADGE_SUFFIX)) useStore.getState().focus(id);
    });

    // Hover: spotlight the neighborhood, dim the rest.
    cy.on("mouseover", "node", (evt) => {
      if (evt.target.hasClass("badge")) return;
      const hood = evt.target.closedNeighborhood();
      cy.elements().not(hood).addClass("dim");
    });
    cy.on("mouseout", "node", () => cy.elements().removeClass("dim"));

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, []);

  // Edge hover → explanatory tooltip (needs dataset for names/citations).
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !dataset) return;
    const over = (evt: cytoscape.EventObject): void => {
      const edge = evt.target;
      if (edge.hasClass("badge-link")) return;
      edge.addClass("hover");
      const claim = dataset.claimsById.get(edge.id());
      if (!claim) return;
      const name = (id: string): string => dataset.persons.get(id)?.primaryName ?? id;
      const pos = edge.renderedMidpoint();
      setEdgeTip({
        x: pos.x,
        y: pos.y,
        text: EDGE_VERB[claim.type](name(claim.from), name(claim.to)),
        citations: claim.citations,
        conflict: Boolean(claim.conflictGroup),
        note: claim.conflictGroup ? "Disputed — click either person for both readings" : claim.note,
      });
    };
    const out = (evt: cytoscape.EventObject): void => {
      evt.target.removeClass("hover");
      setEdgeTip(null);
    };
    cy.on("mouseover", "edge", over);
    cy.on("mouseout", "edge", out);
    return () => {
      cy.off("mouseover", "edge", over);
      cy.off("mouseout", "edge", out);
    };
  }, [dataset]);

  // Sync elements incrementally so unchanged nodes glide to new positions.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !dataset || !subgraph || !focusId) return;

    setEdgeTip(null);
    const desired = new Map<string, ElementDefinition>();

    for (const id of subgraph.nodes) {
      const person = dataset.persons.get(id);
      if (!person) continue;
      const sharesName = [...subgraph.nodes].some(
        (other) => other !== id && dataset.persons.get(other)?.primaryName === person.primaryName,
      );
      const label =
        person.primaryName +
        (sharesName && person.disambiguator ? ` (${shorten(person.disambiguator)})` : "");
      desired.set(id, {
        data: { id, label, gender: person.gender ?? "unknown", unnamed: person.unnamed ?? false },
      });
    }
    for (const [id, count] of subgraph.frontier) {
      const badgeId = `${id}${BADGE_SUFFIX}`;
      desired.set(badgeId, { data: { id: badgeId, label: `+${count}` }, classes: "badge" });
      desired.set(`${badgeId}::edge`, {
        data: { id: `${badgeId}::edge`, source: id, target: badgeId },
        classes: "badge-link",
      });
    }
    const conflictAltSeen = new Set<string>();
    for (const claim of subgraph.edges) {
      const classes: string[] = [];
      if (claim.conflictGroup) {
        classes.push("conflict");
        if (conflictAltSeen.has(claim.conflictGroup)) classes.push("alt");
        conflictAltSeen.add(claim.conflictGroup);
      }
      desired.set(claim.id, {
        data: {
          id: claim.id,
          source: claim.from,
          target: claim.to,
          type: claim.type,
          telescoped: claim.telescoped ?? false,
        },
        classes: classes.join(" "),
      });
    }

    let changed = false;
    cy.batch(() => {
      // Remove elements that are no longer wanted (edges go with their nodes).
      cy.elements().forEach((el) => {
        if (!desired.has(el.id())) {
          el.remove();
          changed = true;
        }
      });
      // Add only genuinely new elements — existing ones keep their positions,
      // which is what lets the layout animate them smoothly.
      const additions: ElementDefinition[] = [];
      for (const [id, def] of desired) {
        if (cy.getElementById(id).length === 0) {
          additions.push(def);
          changed = true;
        }
      }
      // Nodes must be added before edges referencing them.
      additions.sort((a, b) => Number("source" in a.data) - Number("source" in b.data));
      cy.add(additions);

      cy.nodes().removeClass("focus");
      cy.getElementById(focusId).addClass("focus");
      cy.nodes().removeClass("selected");
      if (selectedId) cy.getElementById(selectedId).addClass("selected");
    });
    if (changed) runLayout(cy, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset, subgraph, focusId]);

  // Cheap selection highlight without relayout.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.nodes().removeClass("selected");
    if (selectedId) {
      const node = cy.getElementById(selectedId);
      node.addClass("selected");
      // If the selection came from the timeline/search and is on screen edge,
      // gently bring it into view.
      if (node.length > 0 && !REDUCED_MOTION) {
        const bb = node.renderedBoundingBox();
        const w = cy.width();
        const h = cy.height();
        if (bb.x2 < 0 || bb.x1 > w || bb.y2 < 0 || bb.y1 > h) {
          cy.animate({ center: { eles: node }, duration: 300, easing: "ease-out" });
        }
      }
    }
  }, [selectedId]);

  return (
    <section className="graph-area" aria-label="Family graph">
      <div className="section-bar">
        <span className="section-title">Family graph</span>
        <span className="section-hint">
          <kbd>click</kbd> select · <kbd>2×click</kbd> refocus · <kbd>+n</kbd> expand hidden relatives
        </span>
        <div className="depth-stepper" title="Generations shown above and below the focused person">
          <span className="depth-label">generations</span>
          <button
            className="depth-btn"
            aria-label="Show fewer generations"
            disabled={generationDepth <= 1}
            onClick={() => setGenerationDepth(generationDepth - 1)}
          >
            −
          </button>
          <span className="depth-value">{generationDepth}</span>
          <button
            className="depth-btn"
            aria-label="Show more generations"
            disabled={generationDepth >= 3}
            onClick={() => setGenerationDepth(generationDepth + 1)}
          >
            +
          </button>
        </div>
      </div>

      <div className="graph-canvas-wrap">
        {focusId && breadcrumbs.length > 0 && (
          <nav className="breadcrumbs" aria-label="Previously focused people">
            {breadcrumbs.map((id) => (
              <button key={id} className="crumb" onClick={() => focus(id)}>
                {dataset?.persons.get(id)?.primaryName ?? id}
              </button>
            ))}
            <span className="crumb-current">
              {dataset?.persons.get(focusId)?.primaryName ?? focusId}
            </span>
          </nav>
        )}
        <div ref={containerRef} className="cy-container" />
        {!focusId && <GraphEmptyState />}
        {focusId && <GraphLegend />}
        {edgeTip && (
          <div
            className={`edge-tooltip${edgeTip.conflict ? " conflict" : ""}`}
            style={{ left: edgeTip.x + 14, top: edgeTip.y + 6 }}
          >
            <div>{edgeTip.text}</div>
            {edgeTip.citations.length > 0 && (
              <div className="edge-tooltip-refs">{edgeTip.citations.join(" · ")}</div>
            )}
            {edgeTip.note && <div className="edge-tooltip-note">{edgeTip.note}</div>}
          </div>
        )}
      </div>
    </section>
  );

  function shorten(s: string): string {
    return s.length > 24 ? `${s.slice(0, 22)}…` : s;
  }
}

function GraphEmptyState(): React.ReactElement {
  const focus = useStore((s) => s.focus);
  const starters: Array<{ id: string; label: string }> = [
    { id: "david_994", label: "David" },
    { id: "israel_682", label: "Jacob" },
    { id: "mary_1938", label: "Mary" },
    { id: "moses_2108", label: "Moses" },
  ];
  return (
    <div className="graph-empty-overlay">
      <div className="empty-card">
        <h3>Explore 1,200+ biblical figures</h3>
        <ol className="empty-steps">
          <li>Search for a person above, or start with</li>
        </ol>
        <div className="starter-row">
          {starters.map((s) => (
            <button key={s.id} className="starter-chip" onClick={() => focus(s.id)}>
              {s.label}
            </button>
          ))}
        </div>
        <ol className="empty-steps" start={2}>
          <li>Click any node to read who they are, with verse sources</li>
          <li>Double-click a node to make them the new center</li>
        </ol>
      </div>
    </div>
  );
}
