/**
 * Raw shapes of the Theographic Airtable exports (only the fields we read).
 * These are loose by design: the export has undocumented quirks, and Stage 1
 * logs anomalies rather than crashing on them.
 */

export interface AirtableRecord<F> {
  id: string; // "rec..."
  fields: Partial<F>;
}

export interface TheoPersonFields {
  personLookup: string; // stable slug e.g. "david_994"
  personID: number;
  name: string;
  displayTitle: string;
  status: string;
  isProperName: boolean;
  gender: string;
  alsoCalled: string; // comma/semicolon-separated variant names (observed as string)
  ambiguous: string;
  "Disambiguation (temp)": string;
  verseCount: number;
  verses: string[]; // verse record ids
  minYear: string;
  maxYear: string;
  birthYear: string[] | string;
  deathYear: string[] | string;
  father: string[]; // person record ids
  mother: string[];
  children: string[];
  siblings: string[];
  partners: string[];
  memberOf: string[]; // peopleGroup record ids
  slug: string;
}

export interface TheoVerseFields {
  osisRef: string; // e.g. "Gen.5.3"
  verseID: string;
  book: string[];
  verseNum: string;
  verseText: string;
}

export interface TheoPeopleGroupFields {
  groupName: string;
  members: string[];
}

export interface TheoBookFields {
  bookName: string;
  osisName: string;
  bookOrder: string;
}

export type TheoPerson = AirtableRecord<TheoPersonFields>;
export type TheoVerse = AirtableRecord<TheoVerseFields>;
export type TheoPeopleGroup = AirtableRecord<TheoPeopleGroupFields>;
export type TheoBook = AirtableRecord<TheoBookFields>;
