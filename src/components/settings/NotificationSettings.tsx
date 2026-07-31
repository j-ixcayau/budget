'use client';

import { useEffect, useState } from 'react';
import OneSignal from 'react-onesignal';
import { Card, Button } from '@/components/ui';

const APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;

type PushState = 'unconfigured' | 'unsupported' | 'default' | 'granted' | 'denied';

function currentState(): PushState {
  if (!APP_ID) return 'unconfigured';
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission as PushState;
}

export function NotificationSettings() {
  const [state, setState] = useState<PushState>('unconfigured');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setState(currentState());
  }, []);

  const enable = async () => {
    setBusy(true);
    try {
      // Shows the native permission prompt, then opts this device into push.
      await OneSignal.Notifications.requestPermission();
      await OneSignal.User.PushSubscription.optIn();
    } catch (err) {
      console.error('Failed to enable push notifications', err);
    } finally {
      setState(currentState());
      setBusy(false);
    }
  };

  return (
    <Card title="Notifications">
      <div className="space-y-3 text-sm">
        <p className="text-text-secondary">
          Get bill reminders and monthly balance nudges as push notifications on this device.
        </p>

        {state === 'granted' && (
          <p className="flex items-center gap-2 font-medium text-success">
            <span className="inline-block h-2 w-2 rounded-full bg-success" />
            Enabled on this device
          </p>
        )}

        {state === 'default' && (
          <Button onClick={enable} disabled={busy}>
            {busy ? 'Enabling…' : 'Enable notifications'}
          </Button>
        )}

        {state === 'denied' && (
          <p className="text-text-tertiary">
            Notifications are blocked for this site. Enable them in your browser’s site settings,
            then reload.
          </p>
        )}

        {state === 'unsupported' && (
          <p className="text-text-tertiary">
            This browser doesn’t support push notifications. On iPhone, add the app to your Home
            Screen first, then enable them here.
          </p>
        )}

        {state === 'unconfigured' && (
          <p className="text-text-tertiary">
            Push notifications aren’t configured for this app yet.
          </p>
        )}
      </div>
    </Card>
  );
}
