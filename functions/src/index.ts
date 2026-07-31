import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import { getBillsToNotify } from './recurring.js';

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

export const logShortcutTransaction = onRequest(async (request, response) => {
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
      note: note || `Shortcut: ${merchant || 'Manual Entry'}`,
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
    secrets: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'ONESIGNAL_APP_ID', 'ONESIGNAL_API_KEY'],
    timeZone: 'America/Guatemala', // Optional: Making the timezone explicit
  },
  async (event) => {
    logger.info('Starting daily recurring expense check');
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const appUrl = process.env.APP_URL || 'https://budget.ixcayau.com';
    const oneSignalEnabled = !!(process.env.ONESIGNAL_APP_ID && process.env.ONESIGNAL_API_KEY);

    if (!botToken && !oneSignalEnabled) {
      logger.warn('No notification channel configured (Telegram or OneSignal); skipping');
      return;
    }

    const now = new Date();

    try {
      const usersSnapshot = await db.collection('users').get();

      for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;
        const userData = userDoc.data();
        // Telegram needs a chat id; OneSignal targets the user by external_id (= uid).
        const telegramChatId = botToken
          ? userData.telegramChatId || process.env.TELEGRAM_CHAT_ID
          : undefined;

        if (!telegramChatId && !oneSignalEnabled) {
          logger.debug(`Skipping user ${userId}: no delivery channel available`);
          continue;
        }

        // Remind every day the current month's snapshot is still missing,
        // for the whole month (not just the first week), until it's filled.
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const snapshotQuery = await db
          .collection('monthlySnapshots')
          .where('userId', '==', userId)
          .where('month', '==', currentMonth)
          .limit(1)
          .get();

        if (snapshotQuery.empty) {
          if (botToken && telegramChatId)
            await sendBalanceReminderNotification(botToken, telegramChatId, currentMonth, appUrl);
          await sendOneSignalPush(
            userId,
            'Monthly balance update',
            `It's a new month (${currentMonth}). Update your balances and generate a snapshot to keep your net worth accurate.`,
            `${appUrl}/assets`
          );
        }

        // ── Daily "nothing logged" nudge ─────────────────────────────────────
        // If no expense has been logged in the last ~48h, gently remind the
        // user to capture their spending while it's fresh. This targets the
        // everyday expenses that recurring-bill reminders don't cover.
        const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
        const recentExpenseSnap = await db
          .collection('transactions')
          .where('userId', '==', userId)
          .where('date', '>=', twoDaysAgo)
          .get();
        const hasRecentExpense = recentExpenseSnap.docs.some((d) => d.data().type === 'expense');
        if (!hasRecentExpense) {
          if (botToken && telegramChatId)
            await sendNoExpenseNudge(botToken, telegramChatId, appUrl);
          await sendOneSignalPush(
            userId,
            'Spending check',
            "Logged anything lately? Jot down recent expenses while they're fresh.",
            `${appUrl}/transactions`
          );
        }

        // ── Monthly statement-check reminder ─────────────────────────────────
        // Early each month, nudge the user to reconcile last month's card
        // statement against what they logged (catches anything missed).
        if (now.getDate() === 3) {
          if (botToken && telegramChatId)
            await sendStatementCheckReminder(botToken, telegramChatId, appUrl);
          await sendOneSignalPush(
            userId,
            'Statement check',
            "New month — upload last month's card statement to catch anything you missed.",
            `${appUrl}/import`
          );
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

        // Get transactions from 45 days ago to cover previous month's late bills
        const fortyFiveDaysAgo = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000);
        const transactionsSnapshot = await db
          .collection('transactions')
          .where('userId', '==', userId)
          .where('date', '>=', fortyFiveDaysAgo)
          .get();

        const recentTransactions = transactionsSnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            date: data.date?.toDate ? data.date.toDate() : new Date(data.date),
          } as any;
        });

        // Shared source of truth (identical to the web app's src/lib/recurring.ts):
        // overdue bills (this month or last month within grace) or bills due soon.
        const upcomingBills = getBillsToNotify(recurringExpenses, recentTransactions, now);

        if (upcomingBills.length > 0) {
          if (botToken && telegramChatId)
            await sendTelegramNotification(botToken, telegramChatId, upcomingBills, appUrl);
          const billNames = upcomingBills.map((b) => b.name).join(', ');
          await sendOneSignalPush(
            userId,
            'Bills to log',
            `Don't forget to log: ${billNames}`,
            `${appUrl}/dashboard`
          );
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

async function sendTelegramMessage(
  token: string,
  chatId: string,
  message: string,
  context: string
) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'Markdown' }),
    });
    if (!res.ok) {
      const errText = await res.text();
      logger.error(`Telegram API error (${context})`, { status: res.status, body: errText });
    }
  } catch (error: any) {
    logger.error(`Failed to send ${context}`, { chatId, error: error.message });
  }
}

/**
 * Sends a web push via OneSignal, targeting the user by External ID (= Firebase
 * uid). No-ops when ONESIGNAL_APP_ID / ONESIGNAL_API_KEY aren't configured, and
 * tolerates the "no subscribers" case for users who haven't opted in.
 */
async function sendOneSignalPush(externalId: string, title: string, message: string, url: string) {
  const appId = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_API_KEY;
  if (!appId || !apiKey) return;

  try {
    const res = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Key ${apiKey}`,
      },
      body: JSON.stringify({
        app_id: appId,
        target_channel: 'push',
        include_aliases: { external_id: [externalId] },
        headings: { en: title },
        contents: { en: message },
        url,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      // 400 "no subscribers" is expected for users who haven't enabled push.
      logger.warn('OneSignal push not delivered', {
        externalId,
        status: res.status,
        body: errText,
      });
    }
  } catch (error: any) {
    logger.error('Failed to send OneSignal push', { externalId, error: error.message });
  }
}

async function sendNoExpenseNudge(token: string, chatId: string, appUrl: string) {
  const message =
    `👋 *Spending check*\n\n` +
    `You haven't logged any expenses in the last couple of days. ` +
    `Spend anything? Jot it down while it's fresh — even a rough amount helps.\n\n` +
    `🔗 [Log an expense](${appUrl}/transactions)`;
  await sendTelegramMessage(token, chatId, message, 'no-expense nudge');
}

async function sendStatementCheckReminder(token: string, chatId: string, appUrl: string) {
  const message =
    `🧾 *Statement check*\n\n` +
    `New month! When last month's card statement is ready, upload it to catch anything you ` +
    `forgot to log — it only flags what's missing.\n\n` +
    `🔗 [Check statement](${appUrl}/import)`;
  await sendTelegramMessage(token, chatId, message, 'statement-check reminder');
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
