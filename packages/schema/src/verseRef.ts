import type { VerseRef } from "./person.js";

/**
 * Canonical compact book codes (Protestant 66-book canon), OSIS-flavored.
 * The pipeline normalizes Theographic book names to these; the validator
 * rejects any VerseRef whose book code is not listed here.
 */
export const BOOK_CODES = [
  "Gen", "Exod", "Lev", "Num", "Deut", "Josh", "Judg", "Ruth",
  "1Sam", "2Sam", "1Kgs", "2Kgs", "1Chr", "2Chr", "Ezra", "Neh", "Esth",
  "Job", "Ps", "Prov", "Eccl", "Song", "Isa", "Jer", "Lam", "Ezek",
  "Dan", "Hos", "Joel", "Amos", "Obad", "Jonah", "Mic", "Nah", "Hab",
  "Zeph", "Hag", "Zech", "Mal",
  "Matt", "Mark", "Luke", "John", "Acts", "Rom", "1Cor", "2Cor", "Gal",
  "Eph", "Phil", "Col", "1Thess", "2Thess", "1Tim", "2Tim", "Titus",
  "Phlm", "Heb", "Jas", "1Pet", "2Pet", "1John", "2John", "3John",
  "Jude", "Rev",
] as const;
export type BookCode = (typeof BOOK_CODES)[number];

const BOOK_CODE_SET: ReadonlySet<string> = new Set(BOOK_CODES);

/** Canonical order index for sorting references (0-based). */
const BOOK_ORDER: ReadonlyMap<string, number> = new Map(
  BOOK_CODES.map((b, i) => [b, i]),
);

export interface ParsedVerseRef {
  book: BookCode;
  chapter: number;
  verse?: number;
  verseEnd?: number;
}

const REF_RE = /^((?:[1-3])?[A-Z][a-z]+) (\d+)(?::(\d+)(?:-(\d+))?)?$/;

export function parseVerseRef(ref: VerseRef): ParsedVerseRef | null {
  const m = REF_RE.exec(ref);
  if (!m) return null;
  const [, book, chapter, verse, verseEnd] = m;
  if (!book || !chapter || !BOOK_CODE_SET.has(book)) return null;
  const parsed: ParsedVerseRef = {
    book: book as BookCode,
    chapter: Number(chapter),
  };
  if (verse !== undefined) parsed.verse = Number(verse);
  if (verseEnd !== undefined) parsed.verseEnd = Number(verseEnd);
  return parsed;
}

export function isValidVerseRef(ref: string): boolean {
  return parseVerseRef(ref) !== null;
}

/** Sort key following canonical book order, then chapter, then verse. */
export function verseRefSortKey(ref: VerseRef): number {
  const p = parseVerseRef(ref);
  if (!p) return Number.MAX_SAFE_INTEGER;
  return (BOOK_ORDER.get(p.book) ?? 99) * 1_000_000 + p.chapter * 1_000 + (p.verse ?? 0);
}
