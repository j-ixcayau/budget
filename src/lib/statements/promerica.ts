import type { Line, ParsedStatement } from './types';
import { assembleRows, type ParseEvent } from './assemble';
import { parseAmount, inferYear, isoDate, isNoise, itemsInRange, joinItems } from './shared';

/**
 * Banco Promerica credit-card statements (Visa Signature, Black Mastercard, …).
 *
 * Column geometry observed via pdf.js (x-coordinates):
 *   ~144  Fecha Operación   (MM/DD)
 *   ~196  Fecha Consumo     (MM/DD)   ← used as the transaction date
 *   ~236  Descripción
 *   ~497  Quetzales amount
 *   ~558  Dólares amount
 * A clear gap (~500 vs ~550) separates the Q and USD amount columns.
 */

const DATE_RE = /^\d{2}\/\d{2}$/;
const USD_X_THRESHOLD = 530; // amounts left of this are Quetzales

export function isPromerica(pages: Line[][]): boolean {
  const text = pages
    .flat()
    .map((l) => l.text)
    .join('\n');
  return /Promerica/i.test(text) && /RESUMEN DE CUENTA/i.test(text);
}

export function parsePromerica(pages: Line[][]): ParsedStatement {
  const lines = pages.flat();
  const warnings: string[] = [];

  // Statement close date → year inference.
  let closeMonth = new Date().getMonth() + 1;
  let closeYear = new Date().getFullYear();
  let statementMonth: string | undefined;
  for (const l of lines) {
    if (/FECHA DE CORTE/i.test(l.text)) {
      const m = l.text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (m) {
        closeMonth = parseInt(m[2], 10);
        closeYear = parseInt(m[3], 10);
        statementMonth = `${m[3]}-${m[2]}`;
      }
      break;
    }
  }

  // Card label from the masked number.
  let cardLabel: string | undefined;
  const cardLine = lines.find((l) => /X{4}\s*X{4}\s*X{4}\s*\d{4}/.test(l.text));
  if (cardLine) {
    const last4 = cardLine.text.match(/(\d{4})\s*$/);
    if (last4) cardLabel = `Promerica ••${last4[1]}`;
  }

  // Movements start after the detail column header.
  const startIdx = lines.findIndex(
    (l) => /Descripci/i.test(l.text) && /Quetzales/i.test(l.text) && /D[oó]lares/i.test(l.text)
  );

  const events: ParseEvent[] = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/[UÚ]LTIMA L[IÍ]NEA|ANEXOS/i.test(line.text)) break;

    const opItem = itemsInRange(line.items, 130, 176).find((it) => DATE_RE.test(it.str.trim()));
    const consItem = itemsInRange(line.items, 180, 224).find((it) => DATE_RE.test(it.str.trim()));
    const amountItem = line.items
      .filter((it) => it.x > 450)
      .find((it) => parseAmount(it.str) !== null);
    const descOnLine = joinItems(itemsInRange(line.items, 225, 470));

    if (opItem && amountItem) {
      const dateSrc = (consItem ?? opItem).str.trim();
      const [mm, dd] = dateSrc.split('/').map((n) => parseInt(n, 10));
      const year = inferYear(mm, closeMonth, closeYear);
      const currency = amountItem.x < USD_X_THRESHOLD ? 'Q' : 'USD';
      events.push({
        kind: 'tx',
        date: isoDate(year, mm, dd),
        consumedDate: consItem ? isoDate(year, mm, dd) : undefined,
        amountSigned: parseAmount(amountItem.str)!,
        currency,
        descOnLine,
        raw: line.text,
      });
    } else if (descOnLine && !isNoise(descOnLine)) {
      events.push({ kind: 'frag', text: descOnLine });
    }
  }

  const rows = assembleRows(events);
  const skipped = rows.filter((r) => r.kind === 'payment').length;
  if (skipped) warnings.push(`${skipped} payment/credit row(s) detected and marked to skip.`);

  return { bank: 'promerica', cardLabel, statementMonth, rows, warnings };
}
