import type { Line, TextItem } from './types';

/**
 * Turn a PDF into positioned text lines using pdf.js. Runs entirely in the
 * browser — the file never leaves the device, and there is no per-import AI or
 * server cost. The output shape is deliberately simple (`Line[][]`, one array
 * per page) so the bank parsers can be unit-tested in Node with the same input.
 */

// Group text items sharing (approximately) the same baseline into one line.
function groupIntoLines(items: { str: string; x: number; y: number }[], page: number): Line[] {
  const buckets = new Map<number, TextItem[]>();
  for (const it of items) {
    if (it.str === undefined) continue;
    const key = Math.round(it.y);
    let bucketKey: number | null = null;
    for (const k of buckets.keys()) {
      if (Math.abs(k - key) <= 3) {
        bucketKey = k;
        break;
      }
    }
    const b = bucketKey ?? key;
    if (!buckets.has(b)) buckets.set(b, []);
    buckets.get(b)!.push({ x: it.x, str: it.str });
  }

  return [...buckets.entries()]
    .sort((a, b) => b[0] - a[0]) // top → bottom
    .map(([y, its]) => {
      const sorted = its.sort((a, b) => a.x - b.x);
      return {
        y,
        page,
        items: sorted,
        text: sorted
          .map((i) => i.str)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim(),
      };
    });
}

export async function extractLines(source: ArrayBuffer): Promise<Line[][]> {
  const pdfjs = await import('pdfjs-dist');
  // Wire up the worker (bundled by Next/Turbopack via the URL constructor).
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();

  const pdf = await pdfjs.getDocument({ data: new Uint8Array(source) }).promise;
  const pages: Line[][] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items = content.items
      .filter((i): i is typeof i & { str: string; transform: number[] } => 'str' in i)
      .map((i) => ({ str: i.str, x: i.transform[4], y: i.transform[5] }));
    pages.push(groupIntoLines(items, p));
  }
  return pages;
}
