# Biblical Genealogy Explorer

An interactive genealogy-and-timeline explorer for notable biblical figures.
Blood lineage, non-blood relationships (marriage, concubinage, adoption,
succession, mentorship), and life chronology are all first-class, typed,
verse-cited claims — deliberately **not** forced into a single connected tree.
Job and Melchizedek float freely, exactly as they should.

## Design principles

- **Everything relational is a Claim.** A plain fact is a claim with no
  competitors. Where sources genuinely conflict (Matt 1 vs Luke 3 on Joseph's
  father; the Septuagint's second Cainan in Luke 3:36), competing claims share
  a `conflictGroup` and render side by side with attribution (MT / LXX / NT) —
  never silently resolved.
- **Relative anchors are chronological ground truth.** The text states
  lifespans, ages at fatherhood, and regnal years; absolute dates are a
  swappable `ChronologyLayer` (Theographic estimates, Ussher 1650, …) the user
  toggles. Missing dates fall back to dimmed estimate bars, never blanks.
- **Progressive disclosure.** The graph shows one focus person ±2 generations;
  frontier badges (`+n`) expand outward; double-click refocuses. Non-lineage
  edge types sit behind filter chips. Layout (dagre) runs only on the visible
  subgraph.

## Layout

| Path | What |
|---|---|
| `packages/schema` | Canonical types + zod validators (Person, Claim, Anchor, ChronologyLayer) |
| `packages/pipeline` | Build pipeline: vendor → ingest → verse resolution → notability filter → curation overlay → validate → emit |
| `data/curation` | **Hand-edited YAML overlay** — conflicts, typed edges, name variants, chronology layers, notability overrides |
| `app` | React 19 + Vite SPA: Cytoscape graph, SVG timeline, linked selection |
| `app/public/data` | Emitted static artifacts (committed; ~130KB gzip eager load) |

## Commands

```sh
pnpm install
pnpm vendor      # download Theographic JSON at the pinned commit (once)
pnpm build:data  # run the full pipeline → app/public/data
pnpm dev         # start the app at localhost:5173
pnpm typecheck && pnpm test
pnpm build       # data + production bundle
```

The notability threshold and citation cap live in
`packages/pipeline/src/config.ts`; the pipeline prints the person-count at
several thresholds each run so the 500–1,500 target is easy to retune.

## Data license

Derived from [Theographic Bible Metadata](https://github.com/robertrouse/theographic-bible-metadata)
by Robert Rouse (Viz.Bible) under CC BY-SA 4.0 — see [LICENSE-DATA.md](LICENSE-DATA.md).
App code is MIT.

## Deploying to Cloudflare Pages

The site is fully static — the emitted dataset in `app/public/data/` is
committed, so Cloudflare only needs to build the app itself.

1. Push this repository to GitHub (see below if you're new to this).
2. In the Cloudflare dashboard: **Workers & Pages → Create → Pages →
   Connect to Git**, select the repository.
3. Build settings:
   - Build command: `corepack enable && pnpm install && pnpm build:site`
   - Build output directory: `app/dist`
   (Node version is picked up from `.node-version`.)
4. After the first deploy, open the project's **Custom domains** tab and add
   your domain — since the domain is already on Cloudflare, DNS and HTTPS
   are configured automatically.

### First time with GitHub?

1. Create a free account at [github.com](https://github.com).
2. Install the GitHub CLI: `brew install gh`
3. Sign in: `gh auth login` — choose *GitHub.com → HTTPS → Login with a web
   browser* and follow the prompts.
4. From this folder, publish the repo:
   `gh repo create genealogy --public --source=. --push`

Every future `git push` triggers an automatic redeploy.
