import * as Sentry from '@sentry/nextjs';

const DSN =
  process.env.NEXT_PUBLIC_SENTRY_DSN ??
  'https://873685e1a4ed2f82c602a9e9ff48a657@o4506367206948864.ingest.us.sentry.io/4511858792005632';

Sentry.init({
  dsn: DSN,
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
  enableLogs: true,
});

// Instruments App Router navigations for tracing.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
