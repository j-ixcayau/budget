import { NextRequest, NextResponse } from 'next/server';

const COINGECKO_API = 'https://api.coingecko.com/api/v3/simple/price';

export async function GET(request: NextRequest) {
  const ids = request.nextUrl.searchParams.get('ids');

  if (!ids) {
    return NextResponse.json({ error: 'Missing ids parameter' }, { status: 400 });
  }

  try {
    const url = `${COINGECKO_API}?ids=${encodeURIComponent(ids)}&vs_currencies=usd,eur&include_24hr_change=true`;
    const res = await fetch(url, { next: { revalidate: 60 } });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: 'CoinGecko API error', detail: text },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to fetch prices', detail: String(err) },
      { status: 500 }
    );
  }
}
