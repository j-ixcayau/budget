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
          <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-1">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            className={`w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-100 
              placeholder-zinc-600 transition-all duration-200
              focus:bg-zinc-900 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 
              focus:outline-none ${error ? 'border-red-500/50 ring-4 ring-red-500/10' : ''} ${className}`}
            {...props}
          />
        </div>
        {error && (
          <span className="text-xs text-red-400 font-medium ml-1">
            {error}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
