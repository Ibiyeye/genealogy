import { useEffect, useMemo, useRef, useState } from "react";
import type { Person } from "@genealogy/schema";
import { useStore } from "../store.js";
import { centuryLabel } from "../year.js";

interface Hit {
  person: Person;
  /** Set when the query matched a variant name rather than the primary. */
  matchedVariant?: string | undefined;
}

export function SearchBar(): React.ReactElement {
  const dataset = useStore((s) => s.dataset);
  const layers = useStore((s) => s.layers);
  const chronologyLayerId = useStore((s) => s.chronologyLayerId);
  const focus = useStore((s) => s.focus);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const hits: Hit[] = useMemo(() => {
    if (!dataset || query.trim().length < 2) return [];
    const results = dataset.search.search(query, { prefix: true, fuzzy: 0.2 });
    return results.slice(0, 8).flatMap((r) => {
      const person = dataset.persons.get(String(r.id));
      if (!person) return [];
      const q = query.trim().toLowerCase();
      const matchedVariant = person.variants.find((v) =>
        v.name.toLowerCase().startsWith(q),
      )?.name;
      const primaryMatches = person.primaryName.toLowerCase().includes(q);
      return [{ person, matchedVariant: primaryMatches ? undefined : matchedVariant }];
    });
  }, [dataset, query]);

  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    const onClick = (e: MouseEvent): void => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const choose = (hit: Hit): void => {
    focus(hit.person.id);
    setQuery("");
    setOpen(false);
  };

  const era = (person: Person): string | null => {
    const span = layers[chronologyLayerId]?.spans[person.id];
    if (!span) return null;
    const year = span.birth ?? span.active?.[0];
    return year !== undefined ? centuryLabel(year) : null;
  };

  return (
    <div className="searchbar" ref={boxRef}>
      <input
        type="search"
        placeholder="Search people… (e.g. Israel, Mary, Melchizedek)"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, hits.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && hits[active]) {
            choose(hits[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        aria-label="Search people"
      />
      {open && hits.length > 0 && (
        <ul className="search-results" role="listbox">
          {hits.map((hit, i) => (
            <li
              key={hit.person.id}
              role="option"
              aria-selected={i === active}
              className={i === active ? "active" : ""}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(hit);
              }}
            >
              <span className="hit-name">
                {hit.matchedVariant ? (
                  <>
                    <em>{hit.matchedVariant}</em> → {hit.person.primaryName}
                  </>
                ) : (
                  hit.person.primaryName
                )}
              </span>
              {hit.person.disambiguator && (
                <span className="hit-disambig"> — {hit.person.disambiguator}</span>
              )}
              {era(hit.person) && <span className="hit-era">{era(hit.person)}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
