'use client';

import { useCallback, useEffect, useState } from 'react';
import OneSignal from 'react-onesignal';
import { Card, Button } from '@/components/ui';

const APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;

export function NotificationSettings() {
  const [supported, setSupported] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState(false);

  // Read the real subscription state from OneSignal (not just the browser
  // permission) — a device can be permission-"granted" yet still Unsubscribed.
  const refresh = useCallback(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setSupported(false);
      return;
    }
    setDenied(Notification.permission === 'denied');
    try {
      setSubscribed(Boolean(OneSignal?.User?.PushSubscription?.optedIn));
    } catch {
      setSubscribed(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    // Update when the SDK finishes initializing / the subscription flips.
    try {
      OneSignal.User.PushSubscription.addEventListener('change', refresh);
      OneSignal.Notifications.addEventListener('permissionChange', refresh);
    } catch {
      // SDK not ready yet; the enable() flow will refresh on demand.
    }
  }, [refresh]);

  const enable = async () => {
    setBusy(true);
    try {
      // Prompt for permission (resolves instantly if already granted), then
      // opt this device into push so it becomes a Subscribed subscription.
      await OneSignal.Notifications.requestPermission();
      await OneSignal.User.PushSubscription.optIn();
    } catch (err) {
      console.error('Failed to enable push notifications', err);
    } finally {
      refresh();
      setBusy(false);
    }
  };

  return (
    <Card title="Notifications">
      <div className="space-y-3 text-sm">
        <p className="text-text-secondary">
          Get bill reminders and monthly balance nudges as push notifications on this device.
        </p>

        {!APP_ID ? (
          <p className="text-text-tertiary">
            Push notifications aren’t configured for this app yet.
          </p>
        ) : !supported ? (
          <p className="text-text-tertiary">
            This browser doesn’t support push notifications. On iPhone, add the app to your Home
            Screen first, then enable them here.
          </p>
        ) : subscribed ? (
          <p className="flex items-center gap-2 font-medium text-success">
            <span className="inline-block h-2 w-2 rounded-full bg-success" />
            Enabled on this device
          </p>
        ) : denied ? (
          <p className="text-text-tertiary">
            Notifications are blocked for this site. Enable them in your browser’s site settings,
            then reload.
          </p>
        ) : (
          <Button onClick={enable} disabled={busy}>
            {busy ? 'Enabling…' : 'Enable notifications'}
          </Button>
        )}
      </div>
    </Card>
  );
}
