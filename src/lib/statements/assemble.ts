import type { ParsedRow } from './types';
import { guessCategory } from './categorize';

/** An anchor row detected on a single line (before descriptions are stitched). */
export interface TxEvent {
  kind: 'tx';
  date: string;
  consumedDate?: string;
  amountSigned: number;
  currency: 'Q' | 'USD';
  descOnLine: string;
  raw: string;
}

/** A description-only continuation fragment (wrapped merchant name). */
export interface FragEvent {
  kind: 'frag';
  text: string;
}

export type ParseEvent = TxEvent | FragEvent;

const PAYMENT_HINT = /PAGO,?\s*GRACIAS|PAGO RECIBIDO|ABONO|PAYMENT/i;

/**
 * Stitch wrapped descriptions onto their transactions and produce ParsedRows.
 *
 * Statement descriptions wrap across up to three visual lines: a leading
 * fragment above the amount line, the amount line itself, and a trailing
 * fragment below. We attach leading fragments to the next transaction, and a
 * single trailing fragment to the previous transaction only when that
 * transaction carried no inline description (i.e. its merchant name wrapped).
 */
export function assembleRows(events: ParseEvent[]): ParsedRow[] {
  const rows: ParsedRow[] = [];
  let pendingLead: string[] = [];
  let lastRow: ParsedRow | null = null;
  let lastClosed = true;

  for (const e of events) {
    if (e.kind === 'frag') {
      if (lastRow && !lastClosed) {
        lastRow.description = `${lastRow.description} ${e.text}`.replace(/\s+/g, ' ').trim();
        lastClosed = true;
      } else {
        pendingLead.push(e.text);
      }
      continue;
    }

    const description = [...pendingLead, e.descOnLine]
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    pendingLead = [];

    const isPayment =
      e.amountSigned < 0 || PAYMENT_HINT.test(description) || PAYMENT_HINT.test(e.descOnLine);

    const row: ParsedRow = {
      date: e.date,
      consumedDate: e.consumedDate,
      description,
      amount: Math.abs(e.amountSigned),
      currency: e.currency,
      kind: isPayment ? 'payment' : 'expense',
      category: 'Other',
      raw: e.raw,
    };
    rows.push(row);
    lastRow = row;
    lastClosed = e.descOnLine !== '';
  }

  // Finalise categories now that descriptions are fully stitched.
  for (const r of rows) {
    r.category = guessCategory(r.description);
    if (r.kind === 'payment') r.category = 'Other';
  }

  return rows.filter((r) => r.amount > 0);
}
