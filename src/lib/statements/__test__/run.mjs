// Node test harness: extracts lines with pdf.js (same engine as the browser),
// then runs the pure parser logic via tsx. Validates against real statements.
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs';
import { parseLines } from '../index.ts';

async function extract(path) {
  const data = new Uint8Array(fs.readFileSync(path));
  const pdf = await getDocument({ data }).promise;
  const pages = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items = content.items
      .filter((i) => 'str' in i)
      .map((i) => ({ str: i.str, x: i.transform[4], y: i.transform[5] }));
    const buckets = new Map();
    for (const it of items) {
      const key = Math.round(it.y);
      let bk = null;
      for (const k of buckets.keys()) if (Math.abs(k - key) <= 3) { bk = k; break; }
      const b = bk ?? key;
      if (!buckets.has(b)) buckets.set(b, []);
      buckets.get(b).push({ x: it.x, str: it.str });
    }
    const lines = [...buckets.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([y, its]) => {
        const s = its.sort((a, b) => a.x - b.x);
        return { y, page: p, items: s, text: s.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim() };
      });
    pages.push(lines);
  }
  return pages;
}

const files = process.argv.slice(2);
for (const f of files) {
  const pages = await extract(f);
  const st = parseLines(pages);
  console.log(`\n######## ${f.split('/').pop()} ########`);
  console.log(`bank=${st.bank}  card=${st.cardLabel}  month=${st.statementMonth}  rows=${st.rows.length}`);
  st.warnings.forEach((w) => console.log('  ⚠ ' + w));
  let totQ = 0, totUSD = 0;
  for (const r of st.rows) {
    const flag = r.kind === 'payment' ? 'SKIP' : '    ';
    console.log(`  ${flag} ${r.date} ${String(r.amount).padStart(9)} ${r.currency}  ${r.category.padEnd(13)} ${r.description}`);
    if (r.kind === 'expense') { if (r.currency === 'Q') totQ += r.amount; else totUSD += r.amount; }
  }
  console.log(`  ---- expense totals: Q ${totQ.toFixed(2)} | USD ${totUSD.toFixed(2)}`);
}
