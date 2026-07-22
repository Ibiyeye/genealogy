/**
 * Year display and math for the app. Data years are signed integers,
 * negative = BC (as published by each chronology system). There is no
 * year 0 in BC/AD reckoning — formatting treats -1 as 1 BC and 1 as AD 1;
 * a stored 0 (astronomical 1 BC) is displayed as 1 BC.
 */

export function formatYear(year: number): string {
  if (year < 0) return `${-year} BC`;
  if (year === 0) return "1 BC";
  return `AD ${year}`;
}

/** Century label for search results and tooltips: "10th c. BC", "1st c. AD". */
export function centuryLabel(year: number): string {
  const abs = Math.abs(year <= 0 ? year - 1 : year);
  const century = Math.floor((abs - 1) / 100) + 1;
  const suffix =
    century % 10 === 1 && century % 100 !== 11 ? "st"
    : century % 10 === 2 && century % 100 !== 12 ? "nd"
    : century % 10 === 3 && century % 100 !== 13 ? "rd"
    : "th";
  return `${century}${suffix} c. ${year <= 0 ? "BC" : "AD"}`;
}
