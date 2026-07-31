import { cn } from '@/lib/utils';

/**
 * Set this to a repository asset path once an approved clinic logo exists
 * (e.g. '/brand/aljarallah-mark.svg'). Every monogram in the product renders
 * through `ClinicBrand`, so filling this in swaps the mark everywhere at once —
 * no screen has an inline "AJ" of its own.
 */
const LOGO_SRC: string | null = null;

/** Clinic name and descriptor, kept here so headers don't retype them. */
export const CLINIC_NAME = 'Dr. Al Jarallah Clinic';
export const CLINIC_NAME_SHORT = 'Dr. Al Jarallah';
export const CLINIC_DESCRIPTOR = 'Obesity & Oncology · Kuwait';

type Variant = 'surface' | 'on-brand';

/**
 * The clinic monogram: deep-teal gradient tile with a thin gold rule. Two
 * variants — `surface` for white/sand backgrounds, `on-brand` for the teal
 * header and doctor sidebar, where the tile becomes a translucent well so the
 * gradient behind it stays visible.
 */
export function ClinicBrandMark({
  size = 40,
  variant = 'surface',
  className,
}: {
  size?: number;
  variant?: Variant;
  className?: string;
}) {
  const radius = Math.min(16, Math.max(9, Math.round(size * 0.27)));

  if (LOGO_SRC) {
    return (
      // Static brand asset sized by the caller; the optimizer adds nothing for a
      // small inline mark, and this path is dead until LOGO_SRC is filled in.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={LOGO_SRC}
        alt={CLINIC_NAME}
        width={size}
        height={size}
        className={cn('shrink-0 object-contain', className)}
        style={{ width: size, height: size, borderRadius: radius }}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center border-[1.5px] border-accent font-editorial font-bold leading-none text-surface-soft',
        variant === 'on-brand' ? 'bg-white/[.12]' : 'brand-gradient',
        className,
      )}
      style={{ width: size, height: size, borderRadius: radius, fontSize: Math.round(size * 0.42) }}
    >
      AJ
    </span>
  );
}

/**
 * Mark plus clinic name. `on-brand` inverts the type for the teal header; the
 * descriptor line carries the gold accent on light surfaces, which is the one
 * place the design uses gold for text.
 */
export function ClinicBrand({
  variant = 'surface',
  size = 40,
  short = false,
  descriptor = CLINIC_DESCRIPTOR,
  className,
}: {
  variant?: Variant;
  size?: number;
  /** Use the shortened name — mobile headers where width is tight. */
  short?: boolean;
  /** Pass null to render the name alone. */
  descriptor?: string | null;
  className?: string;
}) {
  const onBrand = variant === 'on-brand';
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <ClinicBrandMark size={size} variant={variant} />
      <span className="min-w-0 leading-tight">
        <span
          className={cn(
            'block truncate font-editorial font-semibold tracking-tight',
            onBrand ? 'text-surface-soft' : 'text-foreground',
            short ? 'text-[16px]' : 'text-[17px]',
          )}
        >
          {short ? CLINIC_NAME_SHORT : CLINIC_NAME}
        </span>
        {descriptor && (
          <span
            className={cn(
              'block truncate text-[11.5px] font-semibold tracking-[0.01em]',
              onBrand ? 'text-surface-soft/70' : 'text-accent-foreground',
            )}
          >
            {descriptor}
          </span>
        )}
      </span>
    </span>
  );
}

/** Prior names, kept so existing shells keep working. */
export function BrandMark({ className, size = 32 }: { className?: string; size?: number }) {
  return <ClinicBrandMark size={size} className={className} />;
}

export function BrandWordmark({ className }: { className?: string }) {
  return <ClinicBrand size={30} className={className} />;
}
