import Link from 'next/link';
import { ArrowRight, Clock, Star } from 'lucide-react';
import { InitialsAvatar } from './avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn, formatCurrency } from '@/lib/utils';
import { specialtyColor } from '@/lib/specialty-colors';
import {
  availabilityTone,
  formatSpecialistRole,
  specialistLanguages,
  specialistRating,
  specialistVisitMode,
} from '@/lib/specialist-meta';
import type { NextAvailable } from '@/lib/specialist-meta';
import type { Practitioner } from '@/lib/data/types';

/**
 * Specialist card — matches the Claude Design spec:
 * avatar with availability dot, name + specialty pill + rating, bio,
 * attribute chips (role / visit mode / insurance / languages), a next-available bar,
 * and a consultation-fee + Book footer.
 *
 * Note: the underlying data type stays `Practitioner` (that's what OpenEMR/FHIR
 * call the entity). The UI vocabulary is "specialist" because the roster
 * includes nurses and technicians too.
 */
export function SpecialistCard({
  specialist,
  nextAvailable,
}: {
  specialist: Practitioner;
  nextAvailable?: NextAvailable;
}) {
  const fullName = `${specialist.title} ${specialist.firstName} ${specialist.lastName}`.trim();
  const color = specialtyColor(specialist.specialty);
  const tone = availabilityTone(nextAvailable);
  const nextAvailableLabel = nextAvailable?.label;
  const roleLabel = formatSpecialistRole(specialist.role);
  const chips = [
    ...(roleLabel ? [roleLabel] : []),
    specialistVisitMode(specialist.id),
    'Accepts insurance',
    specialistLanguages(specialist.id),
  ];

  return (
    <Card className="card-hover flex flex-col overflow-hidden">
      <CardContent className="flex flex-1 flex-col gap-4 p-5">
        {/* Header: avatar + name + specialty + rating */}
        <div className="flex items-start gap-3">
          <div className="relative shrink-0">
            <InitialsAvatar name={`${specialist.firstName} ${specialist.lastName}`} gradient={color.avatar} size={52} />
            <span
              aria-hidden
              className={cn(
                'absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card',
                tone === 'today' && 'bg-emerald-500',
                tone === 'soon' && 'bg-amber-500',
                tone === 'none' && 'bg-slate-300',
              )}
            />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[16px] font-semibold leading-tight tracking-tight">{fullName}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium',
                  color.pill,
                )}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', color.dot)} />
                {specialist.specialty}
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-foreground">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
                {specialistRating(specialist.id)}
              </span>
            </div>
          </div>
        </div>

        {/* Bio */}
        {specialist.bio && <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{specialist.bio}</p>}

        {/* Attribute chips */}
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <span
              key={c}
              className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground"
            >
              {c}
            </span>
          ))}
        </div>

        {/* Next available */}
        {nextAvailableLabel && (
          <div className="flex items-center gap-2 rounded-lg bg-secondary/60 px-3 py-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span>
              Next available <span className="font-semibold text-foreground">{nextAvailableLabel}</span>
            </span>
          </div>
        )}

        {/* Footer: fee + Book */}
        <div className="mt-auto flex items-center justify-between border-t pt-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Consultation</p>
            <p className="text-lg font-semibold tabular-nums">
              {formatCurrency(specialist.consultationFeeMinor, specialist.currency)}
            </p>
          </div>
          <Button asChild className="group/btn">
            <Link href={`/doctors/${specialist.id}`}>
              Book <ArrowRight className="transition-transform group-hover/btn:translate-x-0.5" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
