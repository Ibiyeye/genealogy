import { useEffect, useState } from "react";
import type { Anchor } from "@genealogy/schema";
import { loadDataset, loadChronologyLayer } from "./data/loadDataset.js";
import { useStore } from "./store.js";
import { SearchBar } from "./search/SearchBar.js";
import { DetailPanel } from "./panels/DetailPanel.js";
import { GraphView } from "./graph/GraphView.js";
import { TimelineView } from "./timeline/TimelineView.js";

export function App(): React.ReactElement {
  const dataset = useStore((s) => s.dataset);
  const loadError = useStore((s) => s.loadError);
  const setDataset = useStore((s) => s.setDataset);
  const setLoadError = useStore((s) => s.setLoadError);
  const registerLayer = useStore((s) => s.registerLayer);
  const [anchors, setAnchors] = useState<Anchor[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ds = await loadDataset();
        if (cancelled) return;
        const defaultMeta = ds.manifest.chronologyLayers.find(
          (l) => l.id === ds.manifest.defaultChronologyLayer,
        );
        if (defaultMeta) {
          const layer = await loadChronologyLayer(defaultMeta.file);
          if (cancelled) return;
          registerLayer(layer);
        }
        setDataset(ds);
        const anchorsRes = await fetch("/data/anchors.json");
        if (!cancelled && anchorsRes.ok) {
          setAnchors(((await anchorsRes.json()) as { anchors: Anchor[] }).anchors);
        }
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setDataset, setLoadError, registerLayer]);

  if (loadError) {
    return (
      <div className="app-error">
        <h1>Failed to load dataset</h1>
        <p>{loadError}</p>
        <p>
          Run <code>pnpm build:data</code> to generate <code>app/public/data/</code>.
        </p>
      </div>
    );
  }

  if (!dataset) {
    return <div className="app-loading">Loading dataset…</div>;
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Biblical Genealogy Explorer</h1>
        <SearchBar />
        <div className="header-meta">
          {dataset.manifest.counts.persons.toLocaleString()} people ·{" "}
          {dataset.manifest.counts.claims.toLocaleString()} relationships
        </div>
      </header>
      <main className="app-main">
        <section className="views">
          <GraphView />
          <TimelineView />
        </section>
        <DetailPanel anchors={anchors} />
      </main>
    </div>
  );
}
