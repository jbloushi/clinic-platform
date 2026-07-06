import Link from 'next/link';
import { ArrowRight, Clock } from 'lucide-react';
import { InitialsAvatar } from './avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import type { Practitioner } from '@/lib/data/types';

/**
 * Premium doctor card for the public /doctors listing.
 * Consistent with the calm, medical-SaaS aesthetic — no photos, gradient
 * initials avatar, tight information hierarchy.
 */
export function DoctorCard({
  doctor,
  nextAvailable,
}: {
  doctor: Practitioner;
  nextAvailable?: string;
}) {
  const fullName = `${doctor.title} ${doctor.firstName} ${doctor.lastName}`.trim();
  return (
    <Card className="card-hover flex flex-col overflow-hidden">
      <CardContent className="flex flex-1 flex-col pt-6">
        <div className="flex items-start gap-3">
          <InitialsAvatar name={`${doctor.firstName} ${doctor.lastName}`} size={48} />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[15px] font-semibold leading-tight tracking-tight">{fullName}</h3>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{doctor.specialty}</p>
          </div>
        </div>

        {doctor.bio && (
          <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{doctor.bio}</p>
        )}

        <dl className="mt-4 space-y-1.5 text-sm">
          {nextAvailable && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" aria-hidden />
              <span>
                Next available <span className="font-medium text-foreground">{nextAvailable}</span>
              </span>
            </div>
          )}
        </dl>

        <div className="mt-5 flex items-center justify-between border-t pt-4">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Consultation</p>
            <p className="text-sm font-semibold tabular-nums">
              {formatCurrency(doctor.consultationFeeMinor, doctor.currency)}
            </p>
          </div>
          <Button asChild size="sm" className="group/btn">
            <Link href={`/doctors/${doctor.id}`}>
              Book <ArrowRight className="transition-transform group-hover/btn:translate-x-0.5" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
