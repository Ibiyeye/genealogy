import { useEffect } from "react";
import { useStore } from "./store.js";
import { loadDataset } from "./data/loadDataset.js";
import { HomeView } from "./views/HomeView.js";
import { LineageView } from "./views/LineageView.js";
import { PersonView } from "./views/PersonView.js";
import { AboutView } from "./views/AboutView.js";
import { SearchOverlay } from "./views/SearchOverlay.js";

export function App(): React.ReactElement {
  const dataset = useStore((s) => s.dataset);
  const loadError = useStore((s) => s.loadError);
  const route = useStore((s) => s.route);
  const searchOpen = useStore((s) => s.searchOpen);
  const navigate = useStore((s) => s.navigate);
  const openSearch = useStore((s) => s.openSearch);

  useEffect(() => {
    loadDataset()
      .then((d) => useStore.getState().setDataset(d))
      .catch((err) => useStore.getState().setLoadError(String(err)));
  }, []);

  if (loadError) {
    return (
      <div className="app-error">
        <div>
          <p>The dataset failed to load.</p>
          <p><code>{loadError}</code></p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        {route.name !== "home" ? (
          <button
            className="topbar-btn"
            aria-label="Go back"
            onClick={() => history.back()}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : (
          <span className="topbar-spacer" />
        )}
        <button className="wordmark" onClick={() => navigate({ name: "home" })}>
          Biblekin
        </button>
        <button
          className="topbar-btn"
          aria-label="Search people"
          onClick={() => openSearch(true)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
            <path d="M15.5 15.5L21 21" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <main className="content">
        {!dataset ? (
          <div className="app-loading"><p>Loading the genealogy…</p></div>
        ) : route.name === "home" ? (
          <HomeView />
        ) : route.name === "lineage" ? (
          <LineageView id={route.id} />
        ) : route.name === "person" ? (
          <PersonView id={route.id} />
        ) : (
          <AboutView />
        )}
      </main>

      {searchOpen && dataset && <SearchOverlay />}
    </div>
  );
}
