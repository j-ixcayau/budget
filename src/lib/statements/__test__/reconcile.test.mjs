import { reconcile } from '../../reconcile.ts';

const rows = [
  { date: '2026-06-06', description: 'CAFE BARISTA', amount: 45, currency: 'Q', kind: 'expense', category: 'Food', raw: '' },
  { date: '2026-06-19', description: 'PIZZA HUT', amount: 63.5, currency: 'Q', kind: 'expense', category: 'Food', raw: '' },
  { date: '2026-06-21', description: 'SAN MARTIN', amount: 26.25, currency: 'Q', kind: 'expense', category: 'Food', raw: '' },
  { date: '2026-06-09', description: 'PAGO, GRACIAS', amount: 1933.53, currency: 'Q', kind: 'payment', category: 'Other', raw: '' },
];

const existing = [
  { id: 'a', date: '2026-06-06', amount: 45, currency: 'Q' },     // exact → logged
  { id: 'b', date: '2026-06-20', amount: 65, currency: 'Q' },     // rounded up from 63.5, +1 day
  // 26.25 SAN MARTIN not logged → missing
];

const res = reconcile(rows, existing);
console.log('summary', res.summary);
console.log('missing:', res.missing.map((m) => `${m.row.amount} ${m.row.description}`));
console.log('rounded:', res.rounded.map((m) => `logged ${m.match.amount} vs actual ${m.row.amount} (diff ${m.roundingDiff})`));
console.log('logged:', res.logged.map((m) => `${m.row.amount} ${m.row.description}`));
console.log('payments:', res.payments.map((p) => `${p.amount} ${p.description}`));

const ok =
  res.summary.missing === 1 &&
  res.summary.rounded === 1 &&
  res.summary.logged === 1 &&
  res.payments.length === 1 &&
  res.missing[0].row.amount === 26.25 &&
  res.rounded[0].roundingDiff === 1.5;
console.log(ok ? '\nPASS ✅' : '\nFAIL ❌');
process.exit(ok ? 0 : 1);
