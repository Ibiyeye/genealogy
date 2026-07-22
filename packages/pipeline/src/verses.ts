/**
 * Stage 2 — Verse resolution: verse record ids → compact canonical refs
 * ("Gen 5:3"). The 37MB verses.json is loaded here at build time only;
 * nothing verse-shaped ships to the client beyond per-person ref strings.
 */
import type { VerseRef } from "@genealogy/schema";
import { isValidVerseRef, verseRefSortKey, type BookCode } from "@genealogy/schema";
import type { TheoVerse } from "./theographic.js";

/** OSIS book ids used by Theographic ("Gen.5.3") → our compact codes. */
const OSIS_TO_CODE: Record<string, BookCode> = {
  Gen: "Gen", Exod: "Exod", Lev: "Lev", Num: "Num", Deut: "Deut",
  Josh: "Josh", Judg: "Judg", Ruth: "Ruth",
  "1Sam": "1Sam", "2Sam": "2Sam", "1Kgs": "1Kgs", "2Kgs": "2Kgs",
  "1Chr": "1Chr", "2Chr": "2Chr", Ezra: "Ezra", Neh: "Neh", Esth: "Esth",
  Job: "Job", Ps: "Ps", Prov: "Prov", Eccl: "Eccl", Song: "Song",
  Isa: "Isa", Jer: "Jer", Lam: "Lam", Ezek: "Ezek", Dan: "Dan",
  Hos: "Hos", Joel: "Joel", Amos: "Amos", Obad: "Obad", Jonah: "Jonah",
  Mic: "Mic", Nah: "Nah", Hab: "Hab", Zeph: "Zeph", Hag: "Hag",
  Zech: "Zech", Mal: "Mal",
  Matt: "Matt", Mark: "Mark", Luke: "Luke", John: "John", Acts: "Acts",
  Rom: "Rom", "1Cor": "1Cor", "2Cor": "2Cor", Gal: "Gal", Eph: "Eph",
  Phil: "Phil", Col: "Col", "1Thess": "1Thess", "2Thess": "2Thess",
  "1Tim": "1Tim", "2Tim": "2Tim", Titus: "Titus", Phlm: "Phlm",
  Heb: "Heb", Jas: "Jas", "1Pet": "1Pet", "2Pet": "2Pet",
  "1John": "1John", "2John": "2John", "3John": "3John",
  Jude: "Jude", Rev: "Rev",
};

export interface VerseResolver {
  /** recId → compact ref, canonical-order sortable. */
  resolve(recId: string): VerseRef | undefined;
  anomalies: string[];
}

export function buildVerseResolver(theoVerses: TheoVerse[]): VerseResolver {
  const map = new Map<string, VerseRef>();
  const anomalies: string[] = [];
  for (const rec of theoVerses) {
    const osis = rec.fields.osisRef;
    if (!osis) continue;
    const parts = osis.split(".");
    if (parts.length !== 3) {
      anomalies.push(`verse ${rec.id}: unparseable osisRef "${osis}"`);
      continue;
    }
    const [book, chapter, verse] = parts;
    const code = book ? OSIS_TO_CODE[book] : undefined;
    if (!code) {
      anomalies.push(`verse ${rec.id}: unknown OSIS book "${book}" in "${osis}"`);
      continue;
    }
    const ref = `${code} ${Number(chapter)}:${Number(verse)}`;
    if (!isValidVerseRef(ref)) {
      anomalies.push(`verse ${rec.id}: produced invalid ref "${ref}" from "${osis}"`);
      continue;
    }
    map.set(rec.id, ref);
  }
  return { resolve: (recId) => map.get(recId), anomalies };
}

/**
 * Pick the citation set kept on a Person: first mention (canonical order)
 * plus up to `cap` refs preferring the first mention in each distinct book
 * (a person's spread across books is higher-signal than verse density).
 */
export function selectCitations(refs: VerseRef[], cap: number): VerseRef[] {
  const sorted = [...new Set(refs)].sort((a, b) => verseRefSortKey(a) - verseRefSortKey(b));
  const picked: VerseRef[] = [];
  const seenBooks = new Set<string>();
  for (const ref of sorted) {
    const book = ref.split(" ")[0]!;
    if (!seenBooks.has(book)) {
      seenBooks.add(book);
      picked.push(ref);
      if (picked.length >= cap) return picked;
    }
  }
  for (const ref of sorted) {
    if (picked.length >= cap) break;
    if (!picked.includes(ref)) picked.push(ref);
  }
  return picked.sort((a, b) => verseRefSortKey(a) - verseRefSortKey(b));
}
