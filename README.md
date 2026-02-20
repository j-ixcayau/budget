# Budget App

A minimal, personal finance dashboard built with Next.js, Firebase, and Tailwind CSS.

## Features

- **Dashboard**: Net worth trend, expense categories, and monthly summaries.
- **Transactions**: Log income/expenses with category and currency support.
- **Recurring Expenses**: Manage monthly bills with pending reminders on the dashboard.
- **Assets & Liabilities**: Track your cash, crypto, and debts.
- **Multicurrency**: Support for Q, USD, and EUR with manual conversion rates.
- **Mobile Friendly**: Responsive sidebar and collapsible navigation.

## Setup

1. **Clone the repository**
2. **Install dependencies**: `npm install`
3. **Configure Environment**: 
   - Create a `.env.local` file from `.env.local.example`.
   - Add your Firebase project credentials.
4. **Enable Firebase Services**:
   - Enable **Authentication** (Email/Password).
   - Enable **Firestore Database**.

## Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Hosting Options

### Option 1: Vercel (Recommended)
Next.js is built by Vercel, so it offers the most seamless deployment experience.

1. Create a [Vercel](https://vercel.com) account.
2. Click **New Project** and import your GitHub repository.
3. In **Environment Variables**, add everything from your `.env.local`.
4. Click **Deploy**. Vercel will handle the build and give you a production URL.

### Option 2: Firebase Hosting
Since you are already using Firebase, you can keep your hosting in the same project.

1. Initialize Hosting in your local project:
   ```bash
   firebase init hosting
   ```
   - Select your project.
   - For "Public directory", type `.next` (or keep default `public` and Next.js will handle it).
   - For "Configure as a single-page app", say **Yes**.
2. To deploy:
   ```bash
   npm run build
   firebase deploy --only hosting
   ```

> [!NOTE]
> For Next.js App Router features (like dynamic SSR), Vercel is much easier to manage than Firebase Hosting.

---

## Technical Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Icons**: Heroicons (SVG)
