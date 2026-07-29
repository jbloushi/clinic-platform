import { cn } from '@/lib/utils';

/**
 * Reusable clinic monogram used until an approved logo asset is supplied.
 * Used in the sidebar header and the public marketing pages.
 */
export function BrandMark({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-lg border border-white/15 bg-primary text-white shadow-sm',
        className,
      )}
      style={{ width: size, height: size }}
    >
      <span className="font-editorial text-[0.72em] font-semibold leading-none">AJ</span>
    </span>
  );
}

export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <BrandMark size={28} />
      <span className="leading-tight">
        <span className="block font-editorial text-[15px] font-semibold tracking-tight text-foreground">Dr. Al Jarallah Clinic</span>
        <span className="hidden text-[10px] text-muted-foreground sm:block">Specialist care · Kuwait</span>
      </span>
    </span>
  );
}
