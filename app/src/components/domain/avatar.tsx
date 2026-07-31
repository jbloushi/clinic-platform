import { cn } from '@/lib/utils';
import { specialtyColor } from '@/lib/specialty-colors';

/**
 * Rounded-square avatar radius. The design scales the corner with the avatar
 * (≈13px at 48px, ≈20px at 70px) so a small card avatar and a large profile
 * avatar read as the same shape family rather than two different ones.
 */
function avatarRadius(size: number): number {
  return Math.min(20, Math.max(9, Math.round(size * 0.27)));
}

export function initialsFor(name: string): string {
  return (
    name
      .split(' ')
      .filter((s) => s && !/^(Dr\.?|Mr\.?|Mrs\.?|Ms\.?|Prof\.?)$/i.test(s))
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || '·'
  );
}

/**
 * Branded gradient avatar with initials. Used wherever no real photo exists —
 * the design deliberately prefers a warm brand gradient over stock medical
 * photography.
 */
export function InitialsAvatar({
  name,
  size = 40,
  gradient,
  tone = 'brand',
  className,
}: {
  name: string;
  size?: number;
  /** Gradient override (e.g. specialty color). Falls back to a name hash. */
  gradient?: string;
  /**
   * `on-brand` inverts to a light sand tile with teal initials, for placing on
   * the deep-teal header where a dark gradient would disappear.
   */
  tone?: 'brand' | 'on-brand';
  className?: string;
}) {
  const letters = initialsFor(name);
  const onBrand = tone === 'on-brand';
  const grad = onBrand
    ? 'from-surface-soft to-[#D8D2C4]'
    : gradient ?? specialtyColor(name).avatar;

  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center bg-gradient-to-br font-editorial',
        onBrand ? 'text-primary' : 'text-white',
        grad,
        className,
      )}
      style={{
        width: size,
        height: size,
        borderRadius: avatarRadius(size),
        fontSize: Math.max(11, Math.round(size * 0.36)),
        fontWeight: 700,
        letterSpacing: '-0.01em',
      }}
    >
      {letters}
    </span>
  );
}

/**
 * Doctor/specialist avatar: the real photo when the record has one, otherwise
 * the specialty-tinted initials gradient. Keeps "real assets when available,
 * never invented photography" in one place so no screen has to decide.
 *
 * Takes the fields it needs rather than a full `Practitioner`, so it also works
 * for appointment rows that only carry a denormalised name.
 */
export function DoctorAvatar({
  name,
  specialty,
  photoUrl,
  size = 48,
  tone = 'brand',
  className,
}: {
  /** Display name — used for initials and the image alt text. */
  name: string;
  /** Drives the gradient family when there's no photo. */
  specialty?: string;
  photoUrl?: string | null;
  size?: number;
  /** `on-brand` for placement on the deep-teal header. */
  tone?: 'brand' | 'on-brand';
  className?: string;
}) {
  if (photoUrl) {
    return (
      // Photo URLs come from OpenEMR provider records on hosts we can't
      // enumerate in next.config, so the Image optimizer's remotePatterns
      // allowlist can't cover them.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={name}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        className={cn('shrink-0 border border-border object-cover', className)}
        style={{ width: size, height: size, borderRadius: avatarRadius(size) }}
      />
    );
  }
  return (
    <InitialsAvatar
      name={name}
      size={size}
      tone={tone}
      gradient={specialty ? specialtyColor(specialty).avatar : undefined}
      className={className}
    />
  );
}
