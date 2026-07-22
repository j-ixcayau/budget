'use client';

import { useState, useEffect } from 'react';
import { AuthGuard } from '@/components/layout';
import { Card, Button, Input, Select } from '@/components/ui';
import { useUserSettings } from '@/hooks/useFirestore';
import { useAuth } from '@/hooks/useAuth';
import { updateUserSettings } from '@/lib/firestore';
import { CURRENCY_OPTIONS } from '@/lib/constants';
import type { Currency } from '@/types';

export default function SettingsPage() {
  const { user } = useAuth();
  const { settings, loading } = useUserSettings();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    baseCurrency: 'Q' as Currency,
    rateEUR: '8.5',
    rateUSD: '7.75',
    rateQ: '1',
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        baseCurrency: settings.baseCurrency,
        rateEUR: settings.currencyRates.EUR.toString(),
        rateUSD: settings.currencyRates.USD.toString(),
        rateQ: settings.currencyRates.Q.toString(),
      });
    }
  }, [settings]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await updateUserSettings(user.uid, {
        baseCurrency: formData.baseCurrency,
        currencyRates: {
          EUR: parseFloat(formData.rateEUR),
          USD: parseFloat(formData.rateUSD),
          Q: parseFloat(formData.rateQ),
        },
      });
      // onSnapshot in useUserSettings automatically reflects the update
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthGuard>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-text-primary">Settings</h1>

        <Card title="Currency Settings">
          {loading ? (
            <div className="text-text-secondary">Loading...</div>
          ) : (
            <div className="space-y-4">
              <Select
                label="Base Currency"
                value={formData.baseCurrency}
                onChange={(e) =>
                  setFormData({ ...formData, baseCurrency: e.target.value as Currency })
                }
                options={CURRENCY_OPTIONS}
              />

              <div className="border-t border-border pt-4 mt-4">
                <h4 className="text-sm font-medium text-text-secondary mb-3">
                  Conversion Rates (to base currency)
                </h4>
                <p className="text-xs text-text-tertiary mb-4">
                  Enter the rate to convert each currency to your base currency. For example, if 1
                  USD = 7.75 Q, enter 7.75 for USD rate.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input
                    label="1 Q ="
                    type="number"
                    step="0.01"
                    value={formData.rateQ}
                    onChange={(e) => setFormData({ ...formData, rateQ: e.target.value })}
                  />
                  <Input
                    label="1 USD ="
                    type="number"
                    step="0.01"
                    value={formData.rateUSD}
                    onChange={(e) => setFormData({ ...formData, rateUSD: e.target.value })}
                  />
                  <Input
                    label="1 EUR ="
                    type="number"
                    step="0.01"
                    value={formData.rateEUR}
                    onChange={(e) => setFormData({ ...formData, rateEUR: e.target.value })}
                  />
                </div>
              </div>

              <div className="pt-4">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Settings'}
                </Button>
              </div>
            </div>
          )}
        </Card>

        <Card title="About">
          <div className="text-text-secondary text-sm space-y-2">
            <p>Personal Finance Dashboard</p>
            <p>A minimal budget tracking app for personal use.</p>
            <p className="text-text-tertiary">
              Data is stored in Firebase Firestore and is private to your account.
            </p>
          </div>
        </Card>
      </div>
    </AuthGuard>
  );
}
