'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';

type ToastVariant = 'success' | 'error' | 'info';

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastOptions {
  variant?: ToastVariant;
  /** ms before auto-dismiss. Defaults to 4000; give undo toasts more room. */
  duration?: number;
  action?: ToastAction;
}

interface ToastItem extends Required<Pick<ToastOptions, 'variant' | 'duration'>> {
  id: number;
  message: string;
  action?: ToastAction;
}

interface ToastContextValue {
  toast: (message: string, options?: ToastOptions) => void;
  success: (message: string, options?: ToastOptions) => void;
  error: (message: string, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_STYLES: Record<ToastVariant, { accent: string; icon: ReactNode }> = {
  success: {
    accent: 'border-l-success text-success',
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />,
  },
  error: {
    accent: 'border-l-error text-error',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    ),
  },
  info: {
    accent: 'border-l-secondary text-secondary',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    ),
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, options: ToastOptions = {}) => {
    const id = ++idRef.current;
    const item: ToastItem = {
      id,
      message,
      variant: options.variant ?? 'info',
      duration: options.duration ?? 4000,
      action: options.action,
    };
    setToasts((prev) => [...prev, item]);
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (message, options) => toast(message, { ...options, variant: 'success' }),
      error: (message, options) => toast(message, { ...options, variant: 'error' }),
    }),
    [toast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <ToastCard key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, item.duration);
    return () => clearTimeout(timer);
  }, [item.duration, onDismiss]);

  const { accent, icon } = VARIANT_STYLES[item.variant];

  return (
    <div
      role="status"
      className={`glass-card animate-fade-rise flex items-center gap-3 rounded-md border-l-[3px] px-4 py-3 ${accent}`}
    >
      <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {icon}
      </svg>
      <p className="flex-1 text-sm font-medium text-text-primary">{item.message}</p>
      {item.action && (
        <button
          onClick={() => {
            item.action?.onClick();
            onDismiss();
          }}
          className="shrink-0 rounded-sm px-2 py-1 text-xs font-semibold text-primary hover:bg-surface-hover"
        >
          {item.action.label}
        </button>
      )}
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded-sm p-1 text-text-tertiary hover:text-text-primary"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
