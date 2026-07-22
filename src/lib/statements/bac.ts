import type { Line, ParsedStatement } from './types';
import { assembleRows, type ParseEvent } from './assemble';
import {
  parseAmount,
  monthAbbrToNum,
  inferYear,
  isoDate,
  isNoise,
  itemsInRange,
  joinItems,
} from './shared';

/**
 * BAC Credomatic credit-card statements (e.g. AMEX AA Gold).
 *
 * Column geometry observed via pdf.js (x-coordinates):
 *   ~29   Tipo de transacción  (11 = purchase, 31 = payment)
 *   ~84   Fecha de consumo     (MMM/DD)  ← used as the transaction date
 *   ~132  Fecha de operación   (MMM/DD)
 *   ~174  Descripción
 *   ~350  Quetzales Débitos / ~410 Créditos
 *   ~475  Dólares  Débitos / ~535 Créditos
 * Merchant names frequently wrap onto the line above and/or below the amount.
 */

const DATE_RE = /^[A-Z]{3}\/\d{2}$/i;
const USD_X_THRESHOLD = 430; // amounts left of this are Quetzales

export function isBac(pages: Line[][]): boolean {
  const text = pages
    .flat()
    .map((l) => l.text)
    .join('\n');
  return /baccredomatic|Detalle de movimientos del mes/i.test(text);
}

export function parseBac(pages: Line[][]): ParsedStatement {
  const lines = pages.flat();
  const warnings: string[] = [];

  // Close date: "21-JUN-2026" near "Fecha de corte".
  let closeMonth = new Date().getMonth() + 1;
  let closeYear = new Date().getFullYear();
  let statementMonth: string | undefined;
  for (const l of lines) {
    const m = l.text.match(/(\d{2})-([A-Z]{3})-(\d{4})/i);
    if (m && monthAbbrToNum(m[2]) !== null) {
      closeMonth = monthAbbrToNum(m[2])!;
      closeYear = parseInt(m[3], 10);
      statementMonth = `${m[3]}-${String(closeMonth).padStart(2, '0')}`;
      break;
    }
  }

  let cardLabel: string | undefined;
  const cardLine = lines.find((l) => /\*\d{4}\b/.test(l.text) && /JONATHAN|IXCAYAU/i.test(l.text));
  if (cardLine) {
    const last4 = cardLine.text.match(/\*(\d{4})\b/);
    if (last4) cardLabel = `BAC ••${last4[1]}`;
  }

  const startIdx = lines.findIndex((l) => /Detalle de movimientos del mes/i.test(l.text));

  const events: ParseEvent[] = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    // End of the movements table.
    if (/INTEGRACI[ÓO]N DEL PAGO M/i.test(line.text) || /^D[EÉ]BITO\b/i.test(line.text.trim()))
      break;

    const tipoItem = line.items.find((it) => it.x < 45 && /^\d{2}$/.test(it.str.trim()));
    const consItem = itemsInRange(line.items, 78, 100).find((it) => DATE_RE.test(it.str.trim()));
    const opItem = itemsInRange(line.items, 120, 145).find((it) => DATE_RE.test(it.str.trim()));
    const amountItem = line.items
      .filter((it) => it.x > 335)
      .find((it) => parseAmount(it.str) !== null);
    const descOnLine = joinItems(itemsInRange(line.items, 165, 335));

    if (tipoItem && consItem && amountItem) {
      const [abbr, ddStr] = consItem.str.trim().split('/');
      const mm = monthAbbrToNum(abbr)!;
      const dd = parseInt(ddStr, 10);
      const year = inferYear(mm, closeMonth, closeYear);
      const opDate = opItem
        ? (() => {
            const [oa, od] = opItem.str.trim().split('/');
            const om = monthAbbrToNum(oa)!;
            return isoDate(inferYear(om, closeMonth, closeYear), om, parseInt(od, 10));
          })()
        : undefined;
      const currency = amountItem.x < USD_X_THRESHOLD ? 'Q' : 'USD';
      // A '31' type or an amount in the crédito column is a payment.
      const signed = parseAmount(amountItem.str)!;
      const isPaymentType = tipoItem.str.trim() === '31';
      events.push({
        kind: 'tx',
        date: isoDate(year, mm, dd),
        consumedDate: opDate,
        amountSigned: isPaymentType && signed > 0 ? -signed : signed,
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

  return { bank: 'bac', cardLabel, statementMonth, rows, warnings };
}
