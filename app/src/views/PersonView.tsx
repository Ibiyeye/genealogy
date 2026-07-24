import { useMemo, useState } from "react";
import type { Claim, NameVariant, PersonId } from "@genealogy/schema";
import { useStore } from "../store.js";
import { lifespanLabel } from "../data/loadDataset.js";
import { VerseChips } from "./bits.js";

const KIND_LABELS: Record<string, string> = {
  birth: "birth name",
  renamed: "renamed",
  regnal: "regnal name",
  greek: "Greek",
  hebrew: "Hebrew",
  "alt-spelling": "also spelled",
  title: "title",
};

/**
 * Person-centric family card: parents above, spouses beside, children
 * below — plain stacked cards, so nothing can ever tangle.
 */
export function PersonView({ id }: { id: string }): React.ReactElement {
  const dataset = useStore((s) => s.dataset)!;
  const navigate = useStore((s) => s.navigate);

  const person = dataset.persons.get(id);
  const family = useMemo(() => {
    const mine = dataset.claimsByPerson.get(id) ?? [];
    const parents: Claim[] = [];
    const children: Claim[] = [];
    const partners: Array<{ other: PersonId; claim: Claim }> = [];
    const other: Claim[] = [];
    for (const c of mine) {
      if (c.type === "parent_of") {
        (c.to === id ? parents : children).push(c);
      } else if (c.type === "spouse_of" || c.type === "concubine_of") {
        partners.push({ other: c.from === id ? c.to : c.from, claim: c });
      } else if (c.type === "ancestor_of" || c.type === "sibling_of") {
        // ancestor links shown under "other ties"; siblings derivable
        other.push(c);
      } else {
        other.push(c);
      }
    }
    // Order children by their span start when known, so lists read oldest-first.
    children.sort((a, b) => {
      const ya = dataset.years.spans[a.to]?.active?.[0] ?? dataset.years.spans[a.to]?.birth ?? 9999;
      const yb = dataset.years.spans[b.to]?.active?.[0] ?? dataset.years.spans[b.to]?.birth ?? 9999;
      return ya - yb;
    });
    return { parents, children, partners, other };
  }, [dataset, id]);

  const lineagesWithPerson = useMemo(
    () => dataset.lineages.filter((l) => l.people.some((p) => p.id === id)),
    [dataset, id],
  );

  const anchors = useMemo(
    () =>
      dataset.anchors.filter((a) =>
        "person" in a ? a.person === id : a.parent === id || a.child === id,
      ),
    [dataset, id],
  );

  if (!person) {
    return <div className="placeholder-page"><p>Person not found.</p></div>;
  }

  const years = lifespanLabel(dataset, id);
  const parentConflicts = new Set(
    family.parents.map((c) => c.conflictGroup).filter(Boolean) as string[],
  );

  const personChip = (pid: PersonId, claim?: Claim, sub?: string): React.ReactElement => {
    const p = dataset.persons.get(pid);
    return (
      <button
        key={`${pid}-${claim?.id ?? "x"}`}
        className="person-card family-chip"
        onClick={() => navigate({ name: "person", id: pid })}
      >
        <span className="person-card-name">{p?.primaryName ?? pid}</span>
        {(sub ?? p?.disambiguator) && (
          <span className="person-card-sub">{sub ?? p?.disambiguator}</span>
        )}
        {claim && claim.citations.length > 0 && <VerseChips refs={claim.citations} />}
      </button>
    );
  };

  return (
    <div className="person-view">
      <header className="page-head">
        <h1>{person.primaryName}</h1>
        {person.disambiguator && <p className="page-sub">{person.disambiguator}</p>}
        {years && <p className="person-years">{years}</p>}
        {person.variants.length > 0 && <VariantLines variants={person.variants} />}
      </header>

      {person.bio && <p className="person-bio">{person.bio}</p>}

      {parentConflicts.size > 0 &&
        [...parentConflicts].map((group) => {
          const claims = dataset.conflictGroups.get(group) ?? [];
          return (
            <aside key={group} className="conflict-note">
              <strong>The sources give different fathers.</strong>
              <ul className="conflict-list">
                {claims.map((c) => (
                  <li key={c.id}>
                    {dataset.persons.get(c.from)?.primaryName} —{" "}
                    {c.source.document ?? c.source.tradition}{" "}
                    {c.citations.length > 0 && <VerseChips refs={c.citations} />}
                    {c.note && <div className="conflict-detail">{c.note}</div>}
                  </li>
                ))}
              </ul>
            </aside>
          );
        })}

      <section className="family-section">
        {family.parents.length > 0 && (
          <div className="family-group">
            <h2 className="family-label">Parents</h2>
            <div className="family-row">
              {family.parents.map((c) =>
                personChip(c.from, c, c.conflictGroup ? "one reading" : undefined),
              )}
            </div>
          </div>
        )}

        {family.partners.length > 0 && (
          <div className="family-group">
            <h2 className="family-label">
              {family.partners.length === 1 ? "Spouse" : "Spouses & concubines"}
            </h2>
            <div className="family-row">
              {family.partners.map(({ other, claim }) =>
                personChip(
                  other,
                  claim,
                  claim.type === "concubine_of" ? "concubine" : undefined,
                ),
              )}
            </div>
          </div>
        )}

        {family.children.length > 0 && (
          <div className="family-group">
            <h2 className="family-label">Children · {family.children.length}</h2>
            <div className="family-row">
              {family.children.map((c) => personChip(c.to, c))}
            </div>
          </div>
        )}

        {family.parents.length + family.partners.length + family.children.length === 0 && (
          <p className="no-family">
            No family ties are recorded in Scripture for this person — they
            stand alone, like Melchizedek "without father or mother" (Heb 7:3).
          </p>
        )}
      </section>

      {family.other.length > 0 && (
        <section className="ties-section">
          <h2 className="family-label">Other recorded ties</h2>
          <ul className="ties-list">
            {family.other.map((c) => (
              <li key={c.id}>
                {describeTie(c, id, dataset.persons)}
                {c.citations.length > 0 && <VerseChips refs={c.citations} />}
                {c.telescoped && <span className="tie-note"> (possibly non-immediate)</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {anchors.length > 0 && (
        <section className="ties-section">
          <h2 className="family-label">What the text says about their dates</h2>
          <ul className="ties-list">
            {anchors.map((a, i) => (
              <li key={i}>
                {describeAnchor(a, dataset.persons)}{" "}
                <VerseChips refs={a.citations} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {person.citations.length > 0 && (
        <section className="ties-section">
          <h2 className="family-label">
            Key references
            <span className="verse-count"> · {person.verseCount} verses in all</span>
          </h2>
          <VerseChips refs={person.citations} />
        </section>
      )}

      {lineagesWithPerson.length > 0 && (
        <section className="ties-section">
          <h2 className="family-label">Part of these family lines</h2>
          <div className="family-row">
            {lineagesWithPerson.map((l) => (
              <button
                key={l.id}
                className="mini-chip lineage-chip"
                onClick={() => navigate({ name: "lineage", id: l.id })}
              >
                {l.title}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/**
 * Variants grouped by kind — one labelled line per kind rather than
 * repeating "(also spelled)" after every name. Long lists (Jesus carries
 * 26 messianic titles) collapse behind a toggle so the family stays
 * above the fold.
 */
function VariantLines({ variants }: { variants: NameVariant[] }): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const CAP = 6;

  const byKind = new Map<string, NameVariant[]>();
  for (const v of variants) {
    let list = byKind.get(v.kind);
    if (!list) byKind.set(v.kind, (list = []));
    list.push(v);
  }

  return (
    <div className="variants-block">
      {[...byKind].map(([kind, list]) => {
        const shown = expanded ? list : list.slice(0, CAP);
        const hidden = list.length - shown.length;
        return (
          <p className="variants-line" key={kind}>
            <span className="variant-kind">{KIND_LABELS[kind] ?? kind}: </span>
            {shown.map((v, i) => (
              <span key={v.name}>
                {i > 0 && ", "}
                <em>{v.name}</em>
                {v.citations.length > 0 && (
                  <span className="variant-cite"> ({v.citations.join(", ")})</span>
                )}
              </span>
            ))}
            {hidden > 0 && (
              <button className="variants-more" onClick={() => setExpanded(true)}>
                +{hidden} more
              </button>
            )}
          </p>
        );
      })}
      {expanded && (
        <button className="variants-more" onClick={() => setExpanded(false)}>
          show fewer
        </button>
      )}
    </div>
  );
}

function describeTie(
  c: Claim,
  self: PersonId,
  persons: Map<PersonId, { primaryName: string }>,
): string {
  const name = (pid: PersonId): string => persons.get(pid)?.primaryName ?? pid;
  const other = c.from === self ? c.to : c.from;
  switch (c.type) {
    case "ancestor_of":
      return c.from === self
        ? `Ancestor of ${name(other)}`
        : `Descendant of ${name(other)}`;
    case "sibling_of":
      return `Sibling of ${name(other)}`;
    case "adopted_by":
      return c.from === self ? `Raised/adopted by ${name(other)}` : `Adoptive parent of ${name(other)}`;
    case "succeeded_by":
      return c.from === self ? `Succeeded by ${name(other)}` : `Succeeded ${name(other)}`;
    case "mentored_by":
      return c.from === self ? `Mentored by ${name(other)}` : `Mentor of ${name(other)}`;
    case "contemporary_of":
      return `Contemporary of ${name(other)}`;
    default:
      return `${c.type} ${name(other)}`;
  }
}

function describeAnchor(
  a: { kind: string; [k: string]: unknown },
  persons: Map<PersonId, { primaryName: string }>,
): string {
  const name = (pid: unknown): string =>
    persons.get(pid as PersonId)?.primaryName ?? String(pid);
  switch (a.kind) {
    case "lifespan":
      return `Lived ${a["years"] as number} years`;
    case "age_at_fatherhood":
      return `${name(a["parent"])} was ${a["age"] as number} when ${name(a["child"])} was born`;
    case "regnal_length":
      return `Reigned ${a["years"] as number} years`;
    case "synchronism":
      return `${a["event"] as string} — year ${a["year"] as number} of ${name(a["inYearOfReignOf"])}`;
    case "event_offset":
      return `${a["event"] as string}: ${a["offsetYears"] as number} years ${(a["relativeTo"] as string) ?? ""}`;
    default:
      return a.kind;
  }
}
