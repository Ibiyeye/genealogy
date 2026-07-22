import { useEffect, useMemo, useRef } from "react";
import cytoscape, { type Core, type ElementDefinition } from "cytoscape";
import dagre from "cytoscape-dagre";
import { useStore } from "../store.js";
import { computeSubgraph } from "./subgraph.js";
import { CY_STYLE } from "./style.js";

cytoscape.use(dagre);

/** Layout isolated here so swapping dagre → elk is a one-place change. */
function runLayout(cy: Core): void {
  cy.layout({
    name: "dagre",
    // @ts-expect-error dagre options aren't in the base LayoutOptions type
    rankDir: "TB",
    ranker: "tight-tree",
    nodeSep: 18,
    rankSep: 46,
    edgeSep: 8,
    animate: true,
    animationDuration: 250,
    fit: true,
    padding: 40,
  }).run();
}

const BADGE_SUFFIX = "::badge";

export function GraphView(): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);

  const dataset = useStore((s) => s.dataset);
  const focusId = useStore((s) => s.focusId);
  const selectedId = useStore((s) => s.selectedId);
  const expandedIds = useStore((s) => s.expandedIds);
  const generationDepth = useStore((s) => s.generationDepth);
  const visibleClaimTypes = useStore((s) => s.visibleClaimTypes);
  const focus = useStore((s) => s.focus);

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

  // Mount Cytoscape once.
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

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync elements when the subgraph changes.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !dataset || !subgraph || !focusId) return;

    const t0 = performance.now();
    const elements: ElementDefinition[] = [];

    for (const id of subgraph.nodes) {
      const person = dataset.persons.get(id);
      if (!person) continue;
      elements.push({
        data: {
          id,
          label:
            person.primaryName +
            (person.disambiguator && isAmbiguous(person.primaryName, dataset)
              ? ` (${shorten(person.disambiguator)})`
              : ""),
          gender: person.gender ?? "unknown",
          unnamed: person.unnamed ?? false,
        },
      });
    }

    for (const [id, count] of subgraph.frontier) {
      elements.push({
        data: { id: `${id}${BADGE_SUFFIX}`, label: `+${count}` },
        classes: "badge",
      });
      elements.push({
        data: {
          id: `${id}${BADGE_SUFFIX}::edge`,
          source: id,
          target: `${id}${BADGE_SUFFIX}`,
        },
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
      elements.push({
        data: {
          id: claim.id,
          source: claim.from,
          target: claim.to,
          type: claim.type,
          telescoped: claim.telescoped ?? false,
          conflictLabel: claim.conflictGroup ? "⚠" : "",
        },
        classes: classes.join(" "),
      });
    }

    cy.batch(() => {
      cy.elements().remove();
      cy.add(elements);
      cy.getElementById(focusId).addClass("focus");
      if (selectedId) cy.getElementById(selectedId).addClass("selected");
    });
    runLayout(cy);

    const elapsed = performance.now() - t0;
    if (elapsed > 500) {
      console.warn(`graph rebuild took ${elapsed.toFixed(0)}ms for ${subgraph.nodes.size} nodes`);
    }
  }, [dataset, subgraph, focusId]); // selectedId handled separately below

  // Cheap selection highlight without relayout.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.nodes().removeClass("selected");
    if (selectedId) cy.getElementById(selectedId).addClass("selected");
  }, [selectedId]);

  const breadcrumbs = useStore((s) => s.breadcrumbs);

  // The cy container must ALWAYS be mounted — the one-time Cytoscape init
  // effect needs it to exist even before any person is focused.
  return (
    <div className="graph-area">
      {focusId && breadcrumbs.length > 0 && (
        <nav className="breadcrumbs">
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
      {!focusId && (
        <div className="graph-empty-overlay">
          <p>Search for a person to explore their family graph.</p>
        </div>
      )}
      {focusId && (
        <div className="graph-hint">
          click = select · double-click = refocus · ⊕ badge = expand
        </div>
      )}
    </div>
  );

  function shorten(s: string): string {
    return s.length > 24 ? `${s.slice(0, 22)}…` : s;
  }
  function isAmbiguous(name: string, ds: NonNullable<typeof dataset>): boolean {
    // Only annotate when another person in the CURRENT subgraph shares the name.
    if (!subgraph) return false;
    let count = 0;
    for (const id of subgraph.nodes) {
      if (ds.persons.get(id)?.primaryName === name) count++;
      if (count > 1) return true;
    }
    return false;
  }
}
