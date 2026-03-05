import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
}

export function Card({ children, className = '', title }: CardProps) {
  return (
    <div className={`bg-zinc-900 border border-zinc-800 rounded-lg p-4 ${className}`}>
      {title && <h3 className="text-lg font-semibold text-zinc-100 mb-3">{title}</h3>}
      {children}
    </div>
  );
}
