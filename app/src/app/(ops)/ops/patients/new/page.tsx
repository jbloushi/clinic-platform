import { PageHeader } from '@/components/domain/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { NewPatientForm } from './form';

export default function NewPatientPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Register patient" description="Creates the patient in OpenEMR." />
      <Card>
        <CardContent className="pt-6">
          <NewPatientForm />
        </CardContent>
      </Card>
    </div>
  );
}
