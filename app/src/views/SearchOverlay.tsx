import { useEffect, useRef, useState } from "react";
import type { PersonId } from "@genealogy/schema";
import { useStore } from "../store.js";
import { centuryLabel } from "../year.js";

const STARTERS: Array<{ id: PersonId; label: string }> = [
  { id: "adam_78", label: "Adam" },
  { id: "noah_2210", label: "Noah" },
  { id: "abraham_58", label: "Abraham" },
  { id: "israel_682", label: "Jacob" },
  { id: "moses_2108", label: "Moses" },
  { id: "ruth_2450", label: "Ruth" },
  { id: "david_994", label: "David" },
  { id: "esther_1343", label: "Esther" },
  { id: "mary_1938", label: "Mary" },
  { id: "jesus_905", label: "Jesus" },
];

export function SearchOverlay(): React.ReactElement {
  const dataset = useStore((s) => s.dataset)!;
  const navigate = useStore((s) => s.navigate);
  const openSearch = useStore((s) => s.openSearch);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") openSearch(false);
    };
    window.addEventListener("keydown", onKey);
    // Lock body scroll behind the overlay.
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [openSearch]);

  const results =
    query.trim().length > 0
      ? dataset.search
          .search(query, { prefix: true, fuzzy: 0.2 })
          .slice(0, 24)
          .map((r) => dataset.persons.get(r.id as PersonId))
          .filter((p): p is NonNullable<typeof p> => p !== undefined)
      : [];

  const go = (id: PersonId): void => {
    navigate({ name: "person", id });
  };

  const eraOf = (id: PersonId): string | null => {
    const span = dataset.years.spans[id];
    const y = span?.birth ?? span?.active?.[0];
    return y === undefined ? null : centuryLabel(y);
  };

  /** A hit whose primary name doesn't match the query was found by variant. */
  const variantHit = (p: { primaryName: string; variants: Array<{ name: string }> }): string | null => {
    const q = query.trim().toLowerCase();
    if (q.length === 0 || p.primaryName.toLowerCase().startsWith(q)) return null;
    const v = p.variants.find((v) => v.name.toLowerCase().startsWith(q));
    return v ? v.name : null;
  };

  return (
    <div className="search-overlay" role="dialog" aria-label="Search people">
      <div className="search-head">
        <input
          ref={inputRef}
          value={query}
          placeholder="Search people… (Israel, Mary, Melchizedek)"
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter" && results[active]) {
              go(results[active].id);
            }
          }}
        />
        <button className="search-cancel" onClick={() => openSearch(false)}>
          Cancel
        </button>
      </div>

      {query.trim().length === 0 ? (
        <div className="search-starters">
          <p className="search-hint">Or start with someone well known:</p>
          <div className="family-row">
            {STARTERS.map((s) => (
              <button key={s.id} className="mini-chip" onClick={() => go(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      ) : results.length === 0 ? (
        <p className="search-hint search-empty">
          No one found for “{query}”. Try another spelling — many names have
          variants (Uzziah/Azariah).
        </p>
      ) : (
        <ul className="search-results-list">
          {results.map((p, i) => {
            const via = variantHit(p);
            const era = eraOf(p.id);
            return (
              <li key={p.id}>
                <button
                  className={`search-result${i === active ? " active" : ""}`}
                  onClick={() => go(p.id)}
                  onMouseEnter={() => setActive(i)}
                >
                  <span className="hit-name">
                    {via ? (
                      <>
                        <em>{via}</em> → {p.primaryName}
                      </>
                    ) : (
                      p.primaryName
                    )}
                  </span>
                  {p.disambiguator && <span className="hit-disambig">{p.disambiguator}</span>}
                  {era && <span className="hit-era">{era}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
