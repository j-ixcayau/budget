import type { Line, ParsedStatement, Bank } from './types';
import { isPromerica, parsePromerica } from './promerica';
import { isBac, parseBac } from './bac';
import { extractLines } from './extract';

export * from './types';
export { extractLines } from './extract';

export function detectBank(pages: Line[][]): Bank {
  if (isBac(pages)) return 'bac';
  if (isPromerica(pages)) return 'promerica';
  return 'unknown';
}

/** Parse already-extracted lines. Pure function — used by tests and the UI. */
export function parseLines(pages: Line[][]): ParsedStatement {
  const bank = detectBank(pages);
  if (bank === 'bac') return parseBac(pages);
  if (bank === 'promerica') return parsePromerica(pages);
  return {
    bank: 'unknown',
    rows: [],
    warnings: [
      "Couldn't recognise this statement's bank. Supported today: Banco Promerica and BAC Credomatic.",
    ],
  };
}

/** Full pipeline: PDF bytes → parsed statement. Runs in the browser. */
export async function parseStatement(source: ArrayBuffer): Promise<ParsedStatement> {
  const pages = await extractLines(source);
  return parseLines(pages);
}
