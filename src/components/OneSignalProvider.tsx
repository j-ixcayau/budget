'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import OneSignal from 'react-onesignal';
import * as Sentry from '@sentry/nextjs';
import { useAuth } from '@/hooks/useAuth';

const APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;

/**
 * Initializes the OneSignal Web SDK once on the client and keeps the push
 * subscription tied to the signed-in Firebase user via External ID (= uid),
 * so Cloud Functions can target a user by `external_id` without storing tokens.
 * No-ops when NEXT_PUBLIC_ONESIGNAL_APP_ID isn't configured.
 */
export function OneSignalProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const startedRef = useRef(false);
  const [ready, setReady] = useState(false);

  // One-time SDK init.
  useEffect(() => {
    if (!APP_ID || startedRef.current || typeof window === 'undefined') return;
    startedRef.current = true;
    OneSignal.init({
      appId: APP_ID,
      // Service worker is served from the site root (public/OneSignalSDKWorker.js),
      // which is where the OneSignal SDK requests it by default.
      allowLocalhostAsSecureOrigin: true,
    })
      .then(() => setReady(true))
      .catch((err) => {
        console.error('OneSignal init failed', err);
        // Expected on browsers that can't do web push (e.g. iOS Safari not yet
        // installed to the Home Screen) — don't treat those as errors in Sentry.
        const msg = String((err as Error)?.message ?? err);
        const expected = /not support|unsupported|can only be used/i.test(msg);
        if (!expected) {
          Sentry.captureException(err, { tags: { feature: 'push', phase: 'init' } });
        }
      });
  }, []);

  // Keep External ID in sync with the Firebase session.
  useEffect(() => {
    if (!APP_ID || !ready) return;
    if (user) {
      OneSignal.login(user.uid).catch((err) =>
        Sentry.captureException(err, { tags: { feature: 'push', phase: 'login' } })
      );
    } else {
      OneSignal.logout().catch(() => {});
    }
  }, [ready, user]);

  return <>{children}</>;
}
