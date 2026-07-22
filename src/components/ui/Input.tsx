import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider ml-1">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            className={`w-full bg-surface/60 border border-border rounded-sm px-4 py-2.5 text-text-primary
              placeholder-text-tertiary transition-all duration-200
              focus:bg-surface focus:border-primary/50 focus:ring-4 focus:ring-primary/10
              focus:outline-none ${error ? 'border-error/50 ring-4 ring-error/10' : ''} ${className}`}
            {...props}
          />
        </div>
        {error && <span className="text-xs text-error font-medium ml-1">{error}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';
