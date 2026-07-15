import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/domain/page-header';
import { BrandWordmark } from '@/components/domain/brand-mark';
import { prisma } from '@/lib/db';
import { ServiceBookingFlow } from './service-booking-flow';

export const dynamic = 'force-dynamic';

export default async function BookByServicePage() {
  const services = await prisma.service.findMany({ where: { active: true }, orderBy: { name: 'asc' } });

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b bg-card/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-4 py-3">
          <Link href="/" aria-label="Home">
            <BrandWordmark />
          </Link>
          <Button asChild variant="outline" size="sm">
            <Link href="/doctors">Browse specialists instead</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-6 sm:py-10">
        <PageHeader
          eyebrow="Book by service"
          title="What do you need?"
          description="Pick a service and we'll show you the soonest time across every specialist who can help — no need to pick a name first."
        />

        <ServiceBookingFlow
          services={services.map((s) => ({
            id: s.id,
            name: s.name,
            durationMinutes: s.durationMinutes,
            priceMinor: s.priceMinor,
            currency: s.currency,
          }))}
        />
      </main>
    </div>
  );
}
