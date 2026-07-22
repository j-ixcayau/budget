/**
 * Shared types for bank-statement parsing.
 *
 * The parsing pipeline is intentionally split so it can be unit-tested without
 * a browser:
 *   1. `extract.ts` uses pdf.js to turn a PDF into positioned text `Line[]`.
 *   2. Bank parsers (`promerica.ts`, `bac.ts`) consume `Line[]` — pure data in,
 *      pure data out — so they run identically in Node tests and in the browser.
 */

/** A single positioned text fragment from the PDF. */
export interface TextItem {
  x: number;
  str: string;
}

/** A visual line: text fragments sharing (approximately) the same y, left→right. */
export interface Line {
  /** vertical position (top of page = larger y in pdf.js coordinates) */
  y: number;
  /** page number this line came from (1-based) */
  page: number;
  items: TextItem[];
  /** convenience: all fragments joined with single spaces */
  text: string;
}

export type Bank = 'promerica' | 'bac' | 'unknown';

/** A parsed statement line, before it becomes a Transaction. */
export interface ParsedRow {
  /** Posting/operation date, ISO `YYYY-MM-DD`. */
  date: string;
  /** Consumption date if the statement distinguishes it, ISO `YYYY-MM-DD`. */
  consumedDate?: string;
  description: string;
  /** Always a positive number; sign is captured by `kind`. */
  amount: number;
  currency: 'Q' | 'USD';
  /**
   * `expense`  – a purchase/charge (what we normally import)
   * `payment`  – a card payment or credit (skipped from import by default)
   */
  kind: 'expense' | 'payment';
  /** Best-effort category guess from the merchant name. */
  category: string;
  /** Original text, kept for debugging / manual review. */
  raw: string;
}

export interface ParsedStatement {
  bank: Bank;
  /** e.g. "Visa Signature ••4763" when detectable. */
  cardLabel?: string;
  /** Statement close month, ISO `YYYY-MM`, used for year inference. */
  statementMonth?: string;
  rows: ParsedRow[];
  /** Non-fatal notes surfaced to the user (e.g. "3 rows skipped as payments"). */
  warnings: string[];
}
