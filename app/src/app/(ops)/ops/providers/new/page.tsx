import { PageHeader } from '@/components/domain/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { NewProviderForm } from './form';

export default function NewProviderPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Add provider"
        description="Creates a practitioner record in OpenEMR. Availability is configured after creation."
      />
      <Card>
        <CardContent className="pt-6">
          <NewProviderForm />
        </CardContent>
      </Card>
    </div>
  );
}
