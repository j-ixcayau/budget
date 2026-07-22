import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
}

export function Card({ children, className = '', title }: CardProps) {
  return (
    <div
      className={`glass rounded-lg p-6 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-primary/10 ${className}`}
    >
      {title && (
        <h3 className="text-lg font-semibold text-text-primary mb-4 tracking-tight font-fira-code">
          {title}
        </h3>
      )}
      <div className="relative">{children}</div>
    </div>
  );
}
