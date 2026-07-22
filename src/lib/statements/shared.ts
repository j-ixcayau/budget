import type { Line, TextItem } from './types';

/** Parse "1,933.53", "-1,933.53" or "788.72-" into a signed number, or null. */
export function parseAmount(raw: string): number | null {
  const s = raw.trim();
  if (!/^-?[\d.,]+-?$/.test(s)) return null;
  const trailingNeg = s.endsWith('-');
  const leadingNeg = s.startsWith('-');
  const digits = s.replace(/-/g, '').replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(digits)) return null;
  const n = parseFloat(digits);
  if (isNaN(n)) return null;
  return trailingNeg || leadingNeg ? -n : n;
}

const SPANISH_MONTHS: Record<string, number> = {
  ENE: 1,
  FEB: 2,
  MAR: 3,
  ABR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AGO: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DIC: 12,
  // English fallbacks (some issuers mix)
  JAN: 1,
  APR: 4,
  AUG: 8,
  DEC: 12,
};

export function monthAbbrToNum(abbr: string): number | null {
  return SPANISH_MONTHS[abbr.toUpperCase()] ?? null;
}

/**
 * Given a transaction month and the statement's close month/year, infer the
 * correct calendar year. Statements can straddle a December→January boundary,
 * so a tx whose month is *after* the close month belongs to the previous year.
 */
export function inferYear(txMonth: number, closeMonth: number, closeYear: number): number {
  return txMonth > closeMonth ? closeYear - 1 : closeYear;
}

export function isoDate(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

/** Text fragments that are never part of a real transaction description. */
const NOISE =
  /X{3,}|JONATHAN|NIJAIB|IXCAYAU|N[UÚ]MERO DE TARJETA|TITULAR|D[EÉ]BITO|CR[EÉ]DITO|P[AÁ]GINA|Descripci|www\./i;

export function isNoise(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  return NOISE.test(t);
}

/** Return the fragments of a line whose x falls in [min, max). */
export function itemsInRange(items: TextItem[], min: number, max: number): TextItem[] {
  return items.filter((i) => i.x >= min && i.x < max);
}

/** Join item strings, collapsing whitespace. */
export function joinItems(items: TextItem[]): string {
  return items
    .map((i) => i.str)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Flatten pages of lines into a single ordered stream (page, then top→bottom). */
export function flatten(pages: Line[][]): Line[] {
  return pages.flat();
}
