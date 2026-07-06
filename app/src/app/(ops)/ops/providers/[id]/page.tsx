import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/domain/page-header';
import { getDataProvider } from '@/lib/data';
import { getPractitionerAvailability } from '@/lib/data/platform-repo';
import { AvailabilityEditor } from './availability-editor';

export const dynamic = 'force-dynamic';

export default async function ProviderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const provider = await getDataProvider().getPractitionerById(id);
  if (!provider) notFound();
  const availability = await getPractitionerAvailability(id);

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="w-fit">
        <Link href="/ops/providers">
          <ChevronLeft className="h-4 w-4" /> Back to providers
        </Link>
      </Button>
      <PageHeader
        title={`${provider.title} ${provider.firstName} ${provider.lastName}`}
        description={provider.specialty}
      />

      <Card>
        <CardHeader>
          <CardTitle>Weekly availability</CardTitle>
        </CardHeader>
        <CardContent>
          <AvailabilityEditor providerId={id} initial={availability} />
        </CardContent>
      </Card>
    </div>
  );
}
