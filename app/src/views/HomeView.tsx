import { useStore } from "../store.js";

export function HomeView(): React.ReactElement {
  const dataset = useStore((s) => s.dataset)!;
  const navigate = useStore((s) => s.navigate);
  const openSearch = useStore((s) => s.openSearch);

  return (
    <div className="home">
      <section className="hero">
        <h1>The families of the Bible, one line at a time</h1>
        <p className="hero-sub">
          {dataset.manifest.counts.persons.toLocaleString()} people from Scripture,
          every relationship backed by a verse. Follow a family line below, or
          find one person.
        </p>
        <button className="hero-search" onClick={() => openSearch(true)}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
            <path d="M15.5 15.5L21 21" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
          Search for a person…
        </button>
      </section>

      <section className="lineage-section">
        <h2 className="section-heading">The great family lines</h2>
        <p className="section-sub">
          Continuous chains of descent, exactly as the text records them.
        </p>
        <div className="lineage-cards">
          {dataset.lineages.map((line) => {
            const first = dataset.persons.get(line.people[0]!.id);
            const last = dataset.persons.get(line.people[line.people.length - 1]!.id);
            return (
              <button
                key={line.id}
                className="lineage-card"
                onClick={() => navigate({ name: "lineage", id: line.id })}
              >
                <div className="lineage-card-head">
                  <h3>{line.title}</h3>
                  <span className="lineage-cite">{line.citation}</span>
                </div>
                <p className="lineage-sub">{line.subtitle}</p>
                <p className="lineage-desc">{line.description}</p>
                <div className="lineage-endpoints" aria-hidden="true">
                  <span>{first?.primaryName}</span>
                  <span className="endpoint-line" />
                  <span>{last?.primaryName}</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="how-section">
        <h2 className="section-heading">How to read it</h2>
        <ul className="how-list">
          <li>
            <strong>Tap any person</strong> to see their whole family — parents,
            spouses, children — each tie with its verse.
          </li>
          <li>
            <strong>Where the sources differ</strong> (Matthew and Luke give
            Joseph different fathers), both readings are shown side by side,
            never silently merged.
          </li>
          <li>
            <strong>Dotted steps</strong> mean the text skips generations —
            "son of" in a genealogy can mean grandson or descendant.
          </li>
        </ul>
      </section>

      <footer className="home-footer">
        <button className="link-btn" onClick={() => navigate({ name: "about" })}>
          About the data &amp; sources
        </button>
        <p className="footer-meta">
          {dataset.manifest.counts.claims.toLocaleString()} sourced relationships ·{" "}
          {dataset.manifest.counts.conflictGroups} documented conflicts · CC BY-SA 4.0
        </p>
      </footer>
    </div>
  );
}
