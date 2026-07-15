import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/domain/page-header';
import { getDataProvider } from '@/lib/data';
import { requireStaff } from '@/lib/auth/guards';
import { getPractitionerAvailability, getServicesForSpecialist, listServices } from '@/lib/data/platform-repo';
import { AvailabilityEditor } from './availability-editor';
import { EditDetailsForm } from './edit-details-form';
import { ServicesEditor } from './services-editor';

export const dynamic = 'force-dynamic';

export default async function ProviderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dp = getDataProvider();
  const provider = await dp.getPractitionerById(id);
  if (!provider) notFound();

  const [availability, allServices, assignedServiceIds] = await Promise.all([
    getPractitionerAvailability(id),
    listServices(),
    getServicesForSpecialist(id),
  ]);

  async function toggleActive() {
    'use server';
    await requireStaff(['admin']);
    await getDataProvider().setPractitionerActive(id, !provider!.active);
    revalidatePath(`/ops/providers/${id}`);
    revalidatePath('/ops/providers');
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="w-fit">
        <Link href="/ops/providers">
          <ChevronLeft className="h-4 w-4" /> Back to specialists
        </Link>
      </Button>
      <PageHeader
        title={`${provider.title} ${provider.firstName} ${provider.lastName}`}
        description={provider.specialty}
        actions={
          <div className="flex items-center gap-2">
            {provider.active ? <Badge variant="secondary">Active</Badge> : <Badge variant="outline">Inactive</Badge>}
            <form action={toggleActive}>
              <Button type="submit" size="sm" variant="outline">
                {provider.active ? 'Deactivate' : 'Activate'}
              </Button>
            </form>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <EditDetailsForm practitioner={provider} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Weekly availability</CardTitle>
        </CardHeader>
        <CardContent>
          <AvailabilityEditor providerId={id} initial={availability} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Services offered</CardTitle>
        </CardHeader>
        <CardContent>
          <ServicesEditor
            practitionerId={id}
            allServices={allServices.map((s) => ({ id: s.id, name: s.name }))}
            selectedIds={assignedServiceIds}
          />
        </CardContent>
      </Card>
    </div>
  );
}
