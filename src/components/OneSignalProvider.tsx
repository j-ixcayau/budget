'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import OneSignal from 'react-onesignal';
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
      // Worker is hosted under /onesignal/ to avoid clashing with the
      // Firebase SSR routes at the site root.
      serviceWorkerParam: { scope: '/onesignal/' },
      serviceWorkerPath: 'onesignal/OneSignalSDKWorker.js',
      allowLocalhostAsSecureOrigin: true,
    })
      .then(() => setReady(true))
      .catch((err) => console.error('OneSignal init failed', err));
  }, []);

  // Keep External ID in sync with the Firebase session.
  useEffect(() => {
    if (!APP_ID || !ready) return;
    if (user) {
      OneSignal.login(user.uid).catch(() => {});
    } else {
      OneSignal.logout().catch(() => {});
    }
  }, [ready, user]);

  return <>{children}</>;
}
