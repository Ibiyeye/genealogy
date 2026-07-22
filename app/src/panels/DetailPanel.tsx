import { useMemo } from "react";
import type { Anchor, Claim, Person, PersonId, VerseRef } from "@genealogy/schema";
import { useStore } from "../store.js";
import { formatYear } from "../year.js";

const CLAIM_LABELS: Record<Claim["type"], { as: string; inverse: string }> = {
  parent_of: { as: "Parent of", inverse: "Child of" },
  ancestor_of: { as: "Ancestor of", inverse: "Descendant of" },
  spouse_of: { as: "Spouse of", inverse: "Spouse of" },
  concubine_of: { as: "Concubine of", inverse: "Had concubine" },
  adopted_by: { as: "Adopted by", inverse: "Adopted" },
  succeeded_by: { as: "Succeeded by", inverse: "Succeeded" },
  mentored_by: { as: "Mentored by", inverse: "Mentored" },
  contemporary_of: { as: "Contemporary of", inverse: "Contemporary of" },
  sibling_of: { as: "Sibling of", inverse: "Sibling of" },
};

const TRADITION_LABELS: Record<string, string> = {
  MT: "Masoretic Text",
  LXX: "Septuagint",
  NT: "New Testament",
  theographic: "Theographic import",
  curated: "Curated",
};

function VerseChips({ refs }: { refs: VerseRef[] }): React.ReactElement | null {
  if (refs.length === 0) return null;
  return (
    <span className="verse-chips">
      {refs.map((ref) => (
        <a
          key={ref}
          className="verse-chip"
          href={`https://www.biblegateway.com/passage/?search=${encodeURIComponent(ref)}`}
          target="_blank"
          rel="noreferrer"
          title={`Open ${ref}`}
        >
          {ref}
        </a>
      ))}
    </span>
  );
}

function ConfidenceBadge({ claim }: { claim: Claim }): React.ReactElement | null {
  if (claim.confidence === "explicit") return null;
  return <span className={`badge badge-${claim.confidence}`}>{claim.confidence}</span>;
}

function PersonLink({ id }: { id: PersonId }): React.ReactElement {
  const dataset = useStore((s) => s.dataset);
  const focus = useStore((s) => s.focus);
  const person = dataset?.persons.get(id);
  return (
    <button className="person-link" onClick={() => focus(id)}>
      {person?.primaryName ?? id}
      {person?.disambiguator ? ` (${person.disambiguator})` : ""}
    </button>
  );
}

function ClaimRow({ claim, subject }: { claim: Claim; subject: PersonId }): React.ReactElement {
  const outgoing = claim.from === subject;
  const other = outgoing ? claim.to : claim.from;
  const label = outgoing ? CLAIM_LABELS[claim.type].as : CLAIM_LABELS[claim.type].inverse;
  return (
    <li className="claim-row">
      <span className="claim-label">{label}</span> <PersonLink id={other} />
      {claim.telescoped && (
        <span className="badge badge-telescoped" title="Possibly non-immediate descent (telescoped genealogy)">
          telescoped
        </span>
      )}
      <ConfidenceBadge claim={claim} />
      <VerseChips refs={claim.citations} />
      {claim.note && <div className="claim-note">{claim.note}</div>}
    </li>
  );
}

function ConflictCard({ claims, subject }: { claims: Claim[]; subject: PersonId }): React.ReactElement {
  return (
    <div className="conflict-card">
      <div className="conflict-title">⚠ Competing claims — the sources differ</div>
      {claims.map((claim) => (
        <div key={claim.id} className="conflict-side">
          <div>
            <ClaimRow claim={claim} subject={subject} />
          </div>
          <div className="conflict-attribution">
            {TRADITION_LABELS[claim.source.tradition] ?? claim.source.tradition}
            {claim.source.document ? ` — ${claim.source.document}` : ""}
          </div>
        </div>
      ))}
    </div>
  );
}

function anchorText(anchor: Anchor, persons: Map<PersonId, Person>): string {
  const name = (id: PersonId): string => persons.get(id)?.primaryName ?? id;
  switch (anchor.kind) {
    case "lifespan":
      return `Lived ${anchor.years} years`;
    case "age_at_fatherhood":
      return `${name(anchor.parent)} was ${anchor.age} when ${name(anchor.child)} was born`;
    case "regnal_length":
      return `Reigned ${anchor.years} years (${anchor.realm})`;
    case "synchronism":
      return `${anchor.event} — year ${anchor.year} of ${name(anchor.inYearOfReignOf)}`;
    case "event_offset":
      return `${anchor.event}: ${anchor.offsetYears} years ${anchor.offsetYears >= 0 ? "after" : "before"} ${anchor.relativeTo}`;
  }
}

export function DetailPanel({ anchors }: { anchors: Anchor[] }): React.ReactElement {
  const dataset = useStore((s) => s.dataset);
  const selectedId = useStore((s) => s.selectedId);
  const layers = useStore((s) => s.layers);
  const chronologyLayerId = useStore((s) => s.chronologyLayerId);

  const person = selectedId ? dataset?.persons.get(selectedId) : undefined;

  const { conflictCards, plainClaims } = useMemo(() => {
    if (!dataset || !selectedId) return { conflictCards: [], plainClaims: [] };
    const all = dataset.claimsByPerson.get(selectedId) ?? [];
    const groups = new Map<string, Claim[]>();
    const plain: Claim[] = [];
    for (const claim of all) {
      if (claim.conflictGroup) {
        // Show the FULL group even if some alternatives don't touch this person.
        if (!groups.has(claim.conflictGroup)) {
          groups.set(claim.conflictGroup, dataset.conflictGroups.get(claim.conflictGroup) ?? []);
        }
      } else {
        plain.push(claim);
      }
    }
    const typeOrder: Claim["type"][] = [
      "parent_of", "ancestor_of", "spouse_of", "concubine_of", "sibling_of",
      "adopted_by", "succeeded_by", "mentored_by", "contemporary_of",
    ];
    plain.sort((a, b) => typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type));
    return { conflictCards: [...groups.values()], plainClaims: plain };
  }, [dataset, selectedId]);

  const personAnchors = useMemo(
    () =>
      selectedId
        ? anchors.filter((a) => {
            switch (a.kind) {
              case "lifespan":
              case "regnal_length":
              case "event_offset":
                return a.person === selectedId;
              case "age_at_fatherhood":
                return a.parent === selectedId || a.child === selectedId;
              case "synchronism":
                return a.person === selectedId;
            }
          })
        : [],
    [anchors, selectedId],
  );

  if (!person || !dataset) {
    return (
      <aside className="detail-panel empty">
        <span className="section-label">Person details</span>
        <p>Nothing selected yet.</p>
        <p>
          Click a <strong>node in the graph</strong> or a <strong>bar in the
          timeline</strong> and this panel will show who they are: name
          variants, family claims with verse citations, disputed genealogies
          side by side, and what the text says about their dates.
        </p>
      </aside>
    );
  }

  const span = layers[chronologyLayerId]?.spans[person.id];

  return (
    <aside className="detail-panel">
      <h2>
        {person.primaryName}
        {person.unnamed && <span className="badge badge-unnamed">unnamed figure</span>}
      </h2>
      {person.disambiguator && <div className="disambig">{person.disambiguator}</div>}

      {person.variants.length > 0 && (
        <div className="variants">
          {person.variants.map((v) => (
            <span key={v.name} className="variant">
              <strong>{v.name}</strong> <span className="variant-kind">({v.kind})</span>
              <VerseChips refs={v.citations} />
            </span>
          ))}
        </div>
      )}

      {span && (
        <div className="lifespan">
          {span.birth !== undefined && span.death !== undefined ? (
            <>
              {formatYear(span.birth)} – {formatYear(span.death)}
            </>
          ) : span.active ? (
            <>
              active c. {formatYear(span.active[0])} – {formatYear(span.active[1])}
            </>
          ) : null}
          {span.approx && <span className="badge badge-approx">approx.</span>}
        </div>
      )}

      {person.bio && <p className="bio">{person.bio}</p>}

      <div className="citations-block">
        <span className="section-label">Key references</span>
        <VerseChips refs={person.citations} />
        <span className="verse-count">({person.verseCount} verses total)</span>
      </div>

      {conflictCards.map((group) => (
        <ConflictCard key={group[0]?.conflictGroup} claims={group} subject={person.id} />
      ))}

      {plainClaims.length > 0 && (
        <ul className="claims-list">
          {plainClaims.map((claim) => (
            <ClaimRow key={claim.id} claim={claim} subject={person.id} />
          ))}
        </ul>
      )}

      {personAnchors.length > 0 && (
        <div className="anchors-block">
          <span className="section-label">Stated chronology</span>
          <ul>
            {personAnchors.map((a, i) => (
              <li key={i}>
                {anchorText(a, dataset.persons)} <VerseChips refs={a.citations} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {person.groups.length > 0 && (
        <div className="groups-block">
          {person.groups.map((g) => (
            <span key={g} className="group-tag">{g}</span>
          ))}
        </div>
      )}
    </aside>
  );
}
