import { useMemo, useState } from "react";
import type { Claim, PersonId } from "@genealogy/schema";
import { useStore } from "../store.js";
import { lifespanLabel } from "../data/loadDataset.js";
import { VerseChips } from "./bits.js";

/**
 * A lineage reads as one vertical scroll, one generation per card,
 * connected by a single center line — no crossings by construction.
 */
export function LineageView({ id }: { id: string }): React.ReactElement {
  const dataset = useStore((s) => s.dataset)!;
  const navigate = useStore((s) => s.navigate);
  const [expandedSiblings, setExpandedSiblings] = useState<ReadonlySet<PersonId>>(new Set());

  const line = dataset.lineages.find((l) => l.id === id);

  const childrenOf = useMemo(() => {
    const map = new Map<PersonId, PersonId[]>();
    for (const c of dataset.claims) {
      if (c.type !== "parent_of") continue;
      let list = map.get(c.from);
      if (!list) map.set(c.from, (list = []));
      list.push(c.to);
    }
    return map;
  }, [dataset]);

  if (!line) {
    return <div className="placeholder-page"><p>This family line does not exist.</p></div>;
  }

  const memberIds = new Set(line.people.map((p) => p.id));

  return (
    <div className="lineage-view">
      <header className="page-head">
        <h1>{line.title}</h1>
        <p className="page-sub">
          {line.subtitle} · {line.citation}
        </p>
        <p className="page-desc">{line.description}</p>
        <p className="page-hint">Tap a person for their full family.</p>
      </header>

      <ol className="chain">
        {line.people.map((step, i) => {
          const person = dataset.persons.get(step.id);
          if (!person) return null;
          const claim = step.claim ? dataset.claimsById.get(step.claim) : null;
          const conflict = claim?.conflictGroup
            ? dataset.conflictGroups.get(claim.conflictGroup)
            : null;
          const years = lifespanLabel(dataset, step.id);
          const others = (childrenOf.get(step.id) ?? []).filter(
            (c) => !memberIds.has(c),
          );
          const open = expandedSiblings.has(step.id);
          return (
            <li key={step.id} className="chain-item">
              {claim && (
                <div className={`chain-link${claim.type === "ancestor_of" ? " skipped" : ""}`}>
                  {claim.type === "ancestor_of" && (
                    <span className="skip-note">
                      generations skipped{claim.note ? ` — ${claim.note}` : ""}
                    </span>
                  )}
                  {claim.citations.length > 0 && <VerseChips refs={claim.citations} />}
                </div>
              )}

              {conflict && conflict.length > 1 && (
                <aside className="conflict-note">
                  <strong>Sources differ here.</strong>{" "}
                  {conflict.map((c: Claim, j: number) => {
                    const parent = dataset.persons.get(c.from);
                    return (
                      <span key={c.id}>
                        {j > 0 && " · "}
                        {parent?.primaryName} ({c.citations.join(", ") || c.source.document})
                      </span>
                    );
                  })}
                </aside>
              )}

              <div className="chain-card-row">
                <button
                  className="person-card chain-card"
                  onClick={() => navigate({ name: "person", id: step.id })}
                >
                  <span className="gen-num">{i + 1}</span>
                  <span className="person-card-name">{person.primaryName}</span>
                  {person.disambiguator && (
                    <span className="person-card-sub">{person.disambiguator}</span>
                  )}
                  {years && <span className="person-card-years">{years}</span>}
                </button>
              </div>

              {others.length > 0 && (
                <div className="siblings-block">
                  <button
                    className="siblings-toggle"
                    aria-expanded={open}
                    onClick={() =>
                      setExpandedSiblings((prev) => {
                        const next = new Set(prev);
                        if (next.has(step.id)) next.delete(step.id);
                        else next.add(step.id);
                        return next;
                      })
                    }
                  >
                    {open ? "hide" : "show"} {others.length} other{" "}
                    {others.length === 1 ? "child" : "children"}
                  </button>
                  {open && (
                    <div className="siblings-row">
                      {others.map((cid) => (
                        <button
                          key={cid}
                          className="mini-chip"
                          onClick={() => navigate({ name: "person", id: cid })}
                        >
                          {dataset.persons.get(cid)?.primaryName ?? cid}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
