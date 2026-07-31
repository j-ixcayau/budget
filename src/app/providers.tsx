'use client';

import { AuthProvider } from '@/hooks/useAuth';
import { ToastProvider } from '@/components/ui';
import { OneSignalProvider } from '@/components/OneSignalProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <OneSignalProvider>{children}</OneSignalProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
