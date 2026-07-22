interface SkeletonProps {
  className?: string;
}

/** Pulse placeholder used while list/table data loads. */
export function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`animate-pulse rounded-sm bg-surface-hover/60 ${className}`} />;
}

interface SkeletonListProps {
  rows?: number;
  className?: string;
  rowClassName?: string;
}

/** A vertical stack of skeleton rows — drop-in loading state for lists. */
export function SkeletonList({
  rows = 4,
  className = 'space-y-3',
  rowClassName = 'h-14',
}: SkeletonListProps) {
  return (
    <div className={className}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className={rowClassName} />
      ))}
    </div>
  );
}
