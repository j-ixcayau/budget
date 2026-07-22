import type { Metadata, Viewport } from 'next';
import { Fira_Sans, Fira_Code } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const firaSans = Fira_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-fira-sans',
});

const firaCode = Fira_Code({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-fira-code',
});

export const metadata: Metadata = {
  title: 'Budget',
  description: 'Personal finance dashboard',
};

export const viewport: Viewport = {
  themeColor: '#0a0e17',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${firaSans.variable} ${firaCode.variable} font-sans bg-background text-foreground antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
