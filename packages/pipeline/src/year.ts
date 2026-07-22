/**
 * All year parsing/comparison in the pipeline goes through this module.
 * Theographic year fields are strings of signed integers ("-1085") where
 * negative = BC. There is no year 0 in historical (BC/AD) reckoning; the
 * data layer stores whatever the source system publishes and the app's
 * formatting layer owns display. Here we only parse and sanity-check.
 */

export function parseYear(raw: string | number | undefined | null): number | undefined {
  if (raw === undefined || raw === null) return undefined;
  const s = String(raw).trim();
  if (s === "") return undefined;
  const n = Number(s);
  if (!Number.isInteger(n)) return undefined;
  // Guard against obviously corrupt values; scripture spans ~4000 BC – 100 AD.
  if (n < -5000 || n > 200) return undefined;
  return n;
}

/** First element of a possibly-array Airtable field. */
export function firstYear(raw: string | string[] | undefined): number | undefined {
  if (Array.isArray(raw)) return parseYear(raw[0]);
  return parseYear(raw);
}
