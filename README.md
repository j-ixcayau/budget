# Budget App

A minimal, personal finance dashboard built with Next.js, Firebase, and Tailwind CSS. It tracks multicurrency net worth, recurring bills, and debts, and sends bill/balance reminders via web push and Telegram.

## Features

- **Dashboard**: Net Worth hero with month-over-month delta, compact secondary metrics, net-worth trend, and expenses-by-category chart.
- **Transactions**: Log income/expenses with category and currency support, CSV export, and undo-on-delete.
- **Recurring Expenses**: Manage monthly bills with paid/pending/overdue status on the dashboard.
- **Assets & Liabilities**: Track cash, crypto (live prices), and debts owed / owed-to-you.
- **Statement Import**: Reconcile a card statement against logged transactions to catch anything missed.
- **Multicurrency**: Q, USD, and EUR with manual conversion rates.
- **Reminders**: Scheduled Cloud Function sends bill and monthly-balance nudges — push notifications first (OneSignal), with Telegram as a fallback.
- **Design system**: Design tokens (color, spacing, radius, type) driving a consistent dark UI; installable as a PWA.
- **Error monitoring**: Sentry on the client and server.

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack), React 19
- **Database / Auth**: Firebase Firestore + Firebase Auth
- **Backend**: Firebase Cloud Functions (Node 22) — scheduled reminders + an HTTP endpoint for the iOS Shortcut logger
- **Styling**: Tailwind CSS v4 (design tokens in `src/app/globals.css`)
- **Charts**: Recharts
- **Notifications**: OneSignal (web push) + Telegram Bot API
- **Monitoring**: Sentry (`@sentry/nextjs`)
- **Hosting**: Firebase Hosting with the Next.js web-frameworks (SSR) integration

## Requirements

- **Node 24** (see `.nvmrc` — run `nvm use`). Cloud Functions run on Node 22.
- A Firebase project on the **Blaze** plan (required for SSR + Cloud Functions).

## Setup

1. **Install dependencies**: `npm install`
2. **Configure environment**: copy `.env.local.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_FIREBASE_*` — from Firebase Console → Project Settings.
   - `NEXT_PUBLIC_ONESIGNAL_APP_ID` — optional, for web push (OneSignal → Keys & IDs).
   - `NEXT_PUBLIC_SENTRY_DSN` — optional, a default is baked in.
3. **Enable Firebase services**: Authentication (Email/Password) and Firestore.
4. **Cloud Functions secrets** (only if you deploy functions), set via `firebase functions:secrets:set`:
   `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `ONESIGNAL_APP_ID`, `ONESIGNAL_API_KEY`, `API_SECRET_KEY`.

## Development

```bash
npm run dev      # start the dev server (http://localhost:3000)
npm run lint     # eslint
npm run format   # prettier --write
```

## Deployment

Deploys are automated with GitHub Actions:

- **Push/merge to `main`** runs a full `firebase deploy` (Hosting + Cloud Functions + Firestore rules/indexes) — the same as `npm run deploy`.
- **Pull requests** get a Firebase Hosting **preview channel**.

Required GitHub Actions secrets: `FIREBASE_SERVICE_ACCOUNT_IXCA_BUGDET`, the six `NEXT_PUBLIC_FIREBASE_*` values, `NEXT_PUBLIC_ONESIGNAL_APP_ID`, and (optional, for Sentry source maps) `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`.

To deploy manually instead:

```bash
npm run deploy   # next build && firebase deploy
```
