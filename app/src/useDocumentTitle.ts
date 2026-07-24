import { useEffect } from "react";
import { useStore } from "./store.js";

const BASE = "Biblekin";
const TAGLINE = "The families of the Bible, one line at a time";

/**
 * Keeps the document title and description in step with the current route,
 * so browser tabs, bookmarks and history entries are meaningful.
 *
 * Note: social crawlers do not run JavaScript, so these updates are for
 * humans and in-app navigation only — the share card that Facebook, X or
 * WhatsApp render comes from the static tags in index.html. Per-person
 * share cards would need path routing plus prerendered HTML.
 */
export function useDocumentTitle(): void {
  const route = useStore((s) => s.route);
  const dataset = useStore((s) => s.dataset);

  useEffect(() => {
    let title = `${BASE} — ${TAGLINE}`;
    let description: string | null = null;

    if (dataset) {
      if (route.name === "person") {
        const person = dataset.persons.get(route.id);
        if (person) {
          title = person.disambiguator
            ? `${person.primaryName} (${person.disambiguator}) — ${BASE}`
            : `${person.primaryName} — ${BASE}`;
          description =
            person.bio ??
            `${person.primaryName} in Scripture: family, relationships, and verse references.`;
        }
      } else if (route.name === "lineage") {
        const line = dataset.lineages.find((l) => l.id === route.id);
        if (line) {
          title = `${line.title} — ${BASE}`;
          description = line.description;
        }
      } else if (route.name === "about") {
        title = `About — ${BASE}`;
      }
    }

    document.title = title;
    if (description) {
      let tag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
      if (!tag) {
        tag = document.createElement("meta");
        tag.name = "description";
        document.head.appendChild(tag);
      }
      tag.content = description;
    }
  }, [route, dataset]);
}
