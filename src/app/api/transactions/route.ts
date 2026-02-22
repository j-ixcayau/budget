import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const apiKey = request.headers.get('x-api-key');

    if (apiKey !== process.env.API_SECRET_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    const { userId, amount, merchant, date, currency, category, note } = data;

    if (!userId || !amount || !currency) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Prepare transaction data
    const transactionData = {
      userId,
      amount: parseFloat(amount),
      currency: currency || 'Q',
      category: category || 'Other',
      type: 'expense',
      date: date ? admin.firestore.Timestamp.fromDate(new Date(date)) : admin.firestore.FieldValue.serverTimestamp(),
      note: note || `Apple Pay: ${merchant || 'Unknown Merchant'}`,
    };

    // Save to Firestore
    const docRef = await adminDb.collection('transactions').add(transactionData);

    return NextResponse.json({ 
      success: true, 
      id: docRef.id,
      message: 'Transaction logged successfully' 
    });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
