import { cn } from '@/lib/utils';

/**
 * The clinic mark — a small gradient tile with a plus glyph.
 * Used in the sidebar header and the public marketing pages.
 */
export function BrandMark({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-lg text-white shadow-sm',
        'bg-gradient-to-br from-primary to-blue-700',
        className,
      )}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 24 24" width={Math.round(size * 0.55)} height={Math.round(size * 0.55)} fill="none">
        <path d="M12 4v16M4 12h16" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <BrandMark size={28} />
      <span className="text-[15px] font-semibold tracking-tight text-foreground">Clinic</span>
    </span>
  );
}
