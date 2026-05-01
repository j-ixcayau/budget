import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';

admin.initializeApp();
const db = admin.firestore();

/**
 * Parses a currency-formatted string into a plain float.
 * Handles formats sent by the iOS Wallet tap trigger, e.g.:
 *   "Q 25.00"  →  25
 *   "$1,234.50" → 1234.5
 *   "GTQ100"    → 100
 *   "25,00"     → 25   (European comma-decimal)
 *   25          → 25   (already a number)
 */
function parseFormattedAmount(raw: unknown): number {
  if (typeof raw === 'number') return raw;
  if (raw === null || raw === undefined) return NaN;

  // Convert to string and strip currency symbols, letters, and whitespace
  let str = String(raw).trim();

  // Remove currency codes (3-letter like GTQ, USD, EUR) and symbols (Q, $, €, £)
  str = str
    .replace(/[A-Z]{3}/g, '')
    .replace(/[Q$€£¥₩]/g, '')
    .trim();

  // Determine decimal format:
  // If the string has both comma and period, the last one is the decimal separator
  // If only a comma exists and it's followed by exactly 2 digits at the end → European decimal
  const hasComma = str.includes(',');
  const hasPeriod = str.includes('.');

  if (hasComma && hasPeriod) {
    // e.g. "1,234.50" → remove commas; "1.234,50" → remove periods, replace comma
    if (str.lastIndexOf('.') > str.lastIndexOf(',')) {
      str = str.replace(/,/g, ''); // "1,234.50" → "1234.50"
    } else {
      str = str.replace(/\./g, '').replace(',', '.'); // "1.234,50" → "1234.50"
    }
  } else if (hasComma && !hasPeriod) {
    // e.g. "25,00" (European) or "1,234" (thousand separator)
    const parts = str.split(',');
    if (parts.length === 2 && parts[1].length === 2) {
      str = str.replace(',', '.'); // "25,00" → "25.00"
    } else {
      str = str.replace(/,/g, ''); // "1,234" → "1234"
    }
  }

  return parseFloat(str);
}

export const logApplePayTransaction = onRequest(async (request, response) => {
  logger.info('Incoming transaction request', {
    method: request.method,
    headers: request.headers,
    body: request.body,
  });

  try {
    const apiKey = request.headers['x-api-key'];

    if (apiKey !== process.env.API_SECRET_KEY) {
      logger.warn('Unauthorized request: API key mismatch');
      response.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (request.method !== 'POST') {
      logger.warn(`Method not allowed: ${request.method}`);
      response.status(405).json({ error: 'Method Not Allowed' });
      return;
    }

    const data = request.body;
    const { userId, merchant, date, currency, category, note } = data;

    // Parse amount from any format the iOS tap trigger may send:
    // e.g. "Q 25.00", "$1,234.50", "GTQ100", "25,00" (European), or plain 25
    const amount = parseFormattedAmount(data.amount);

    if (!userId || !currency) {
      logger.warn('Missing required fields', { userId, rawAmount: data.amount, currency });
      response.status(400).json({ error: 'Missing required fields' });
      return;
    }

    if (isNaN(amount) || amount <= 0) {
      logger.warn('Invalid or zero amount received — transaction rejected', {
        rawAmount: data.amount,
        parsedAmount: amount,
        userId,
        merchant,
      });
      response.status(400).json({ error: 'Invalid amount: must be a positive number' });
      return;
    }

    // Safe date parsing
    let transactionDate;
    if (date) {
      const parsedDate = new Date(date);
      if (!isNaN(parsedDate.getTime())) {
        transactionDate = admin.firestore.Timestamp.fromDate(parsedDate);
      } else {
        logger.warn('Invalid date provided, falling back to server timestamp', { date });
        transactionDate = admin.firestore.FieldValue.serverTimestamp();
      }
    } else {
      transactionDate = admin.firestore.FieldValue.serverTimestamp();
    }

    const transactionData = {
      userId,
      amount,
      currency: currency || 'Q',
      category: category || 'Other',
      type: 'expense',
      date: transactionDate,
      note: note || `Apple Pay: ${merchant || 'Unknown Merchant'}`,
    };

    logger.info('Attempting to save transaction to Firestore', { transactionData });
    const docRef = await db.collection('transactions').add(transactionData);
    logger.info('Transaction saved successfully', { docId: docRef.id });

    response.json({
      success: true,
      id: docRef.id,
      message: 'Transaction logged successfully',
    });
  } catch (error: any) {
    logger.error('Function Error', { error: error.message, stack: error.stack });
    response.status(500).json({ error: error.message });
  }
});

export const checkRecurringExpenses = onSchedule(
  {
    schedule: '0 10 * * *',
    secrets: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'],
    timeZone: 'America/Guatemala', // Optional: Making the timezone explicit
  },
  async (event) => {
    logger.info('Starting daily recurring expense check');
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const appUrl = process.env.APP_URL || 'https://ixca-bugdet.web.app';

    if (!botToken) {
      logger.warn('TELEGRAM_BOT_TOKEN not configured, skipping notifications');
      return;
    }

    const now = new Date();
    const isFirstWeekOfMonth = now.getDate() <= 7;

    try {
      const usersSnapshot = await db.collection('users').get();

      for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;
        const userData = userDoc.data();
        const userChatId = userData.telegramChatId || process.env.TELEGRAM_CHAT_ID;

        if (!userChatId) {
          logger.debug(`Skipping user ${userId}: No telegramChatId configured`);
          continue;
        }

        // On the 1st-7th, check if this month's snapshot exists and remind if not
        if (isFirstWeekOfMonth) {
          const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
          const snapshotQuery = await db
            .collection('monthlySnapshots')
            .where('userId', '==', userId)
            .where('month', '==', currentMonth)
            .limit(1)
            .get();

          if (snapshotQuery.empty) {
            await sendBalanceReminderNotification(botToken, userChatId, currentMonth, appUrl);
          }
        }

        // Get active recurring expenses
        const recurringSnapshot = await db
          .collection('recurringExpenses')
          .where('userId', '==', userId)
          .where('isActive', '==', true)
          .get();

        if (recurringSnapshot.empty) continue;

        const recurringExpenses = recurringSnapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as any
        );

        // Get this month's transactions
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const transactionsSnapshot = await db
          .collection('transactions')
          .where('userId', '==', userId)
          .where('date', '>=', firstDayOfMonth)
          .get();

        const monthTransactions = transactionsSnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            date: data.date,
          } as any;
        });

        // Filter pending bills
        const pendingBills = recurringExpenses.filter((expense: any) => {
          const nameLower = expense.name.toLowerCase();
          const isLogged = monthTransactions.some((tx: any) => {
            if (tx.note?.toLowerCase().includes(nameLower)) return true;
            if (tx.category === expense.category && expense.isFixed) {
              return Math.abs(tx.amount - expense.defaultAmount) < 0.01;
            }
            return false;
          });
          return !isLogged;
        });

        // Find bills due in the next 3 days (or already due this month)
        const todayDay = now.getDate();
        const upcomingBills = pendingBills.filter((bill: any) => bill.dayOfMonth <= todayDay + 3);

        if (upcomingBills.length > 0) {
          await sendTelegramNotification(botToken, userChatId, upcomingBills, appUrl);
        }
      }
    } catch (error: any) {
      logger.error('Error in checkRecurringExpenses', { error: error.message });
    }
  }
);

async function sendBalanceReminderNotification(
  token: string,
  chatId: string,
  month: string,
  appUrl: string
) {
  const message =
    `📊 *Monthly Balance Update Reminder*\n\n` +
    `It's a new month (${month})! Time to:\n\n` +
    `1️⃣ Update your asset balances\n` +
    `2️⃣ Generate a monthly snapshot\n\n` +
    `This keeps your net worth history accurate.\n\n` +
    `🔗 [Open Assets](${appUrl}/assets)`;

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      logger.error('Telegram API error (balance reminder)', { status: res.status, body: errText });
    }
  } catch (error: any) {
    logger.error('Failed to send balance reminder', { chatId, error: error.message });
  }
}

async function sendTelegramNotification(
  token: string,
  chatId: string,
  bills: any[],
  appUrl: string
) {
  let message = "🔔 *Upcoming Recurring Expenses*\n\nDon't forget to log these bills:\n\n";

  bills.forEach((bill) => {
    message += `• *${bill.name}*\n  💰 ${bill.currency} ${bill.defaultAmount}\n  📅 Due Day: ${bill.dayOfMonth}\n  🏷️ Category: ${bill.category}\n\n`;
  });

  message += `🔗 [Open Dashboard](${appUrl}/dashboard)`;

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      logger.error('Telegram API error (recurring bills)', { status: res.status, body: errText });
    } else {
      logger.info(`Successfully sent notification to ${chatId}`);
    }
  } catch (error: any) {
    logger.error('Failed to send recurring bills notification', { chatId, error: error.message });
  }
}
