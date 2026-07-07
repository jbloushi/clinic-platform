import { cn } from '@/lib/utils';

/**
 * Deterministic gradient avatar with initials. No photos — clean, calm,
 * on-brand for a clinical product.
 */
export function InitialsAvatar({
  name,
  size = 40,
  gradient,
  className,
}: {
  name: string;
  size?: number;
  /** Optional gradient override (e.g. specialty color). Falls back to a name hash. */
  gradient?: string;
  className?: string;
}) {
  const letters = name
    .split(' ')
    .filter((s) => s && !/^(Dr\.?|Mr\.?|Mrs\.?|Ms\.?|Prof\.?)$/i.test(s))
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '·';

  // Deterministic pastel-blue family — keeps the palette calm.
  const palette = [
    'from-blue-500 to-blue-700',
    'from-sky-500 to-blue-600',
    'from-indigo-500 to-blue-700',
    'from-cyan-600 to-blue-700',
    'from-teal-500 to-cyan-700',
    'from-blue-600 to-indigo-700',
  ];
  const grad = gradient ?? palette[Math.abs(hash(name)) % palette.length];

  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-white',
        grad,
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(11, Math.round(size * 0.36)),
        fontWeight: 600,
        letterSpacing: '-0.01em',
      }}
    >
      {letters}
    </span>
  );
}

function hash(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) | 0;
  return n;
}
