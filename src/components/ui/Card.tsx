import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
}

export function Card({ children, className = '', title }: CardProps) {
  return (
    <div className={`glass rounded-xl p-6 transition-all duration-300 hover:shadow-indigo-500/10 ${className}`}>
      {title && (
        <h3 className="text-lg font-semibold text-zinc-100 mb-4 tracking-tight">
          {title}
        </h3>
      )}
      <div className="relative">
        {children}
      </div>
    </div>
  );
}
