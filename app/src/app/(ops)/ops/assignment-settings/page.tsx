import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/domain/page-header';
import { requireStaff } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { AssignmentSettingsForm } from './assignment-settings-form';

export const dynamic = 'force-dynamic';

export default async function AssignmentSettingsPage() {
  await requireStaff(['admin']);

  // The migration seeds this row, but upsert here too — an unconfigured
  // install (fresh DB, migration not yet run) should still show a form with
  // sane defaults rather than crash the page.
  const settings = await prisma.assignmentSettings.upsert({
    where: { id: 'singleton' },
    create: {},
    update: {},
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assignment settings"
        description="Rules the auto-assignment engine and every hold's reservation window read. Changes apply immediately to the next booking — nothing here needs a redeploy."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ranking</CardTitle>
        </CardHeader>
        <CardContent>
          <AssignmentSettingsForm
            settings={{
              preferPreviousPractitioner: settings.preferPreviousPractitioner,
              workloadWindowDays: settings.workloadWindowDays,
              useLeastRecentlyAssigned: settings.useLeastRecentlyAssigned,
              allowBackupTier: settings.allowBackupTier,
              holdDurationMinutes: settings.holdDurationMinutes,
              slotSearchWindowDays: settings.slotSearchWindowDays,
              slotQuantumMinutes: settings.slotQuantumMinutes,
              showDoctorNameBeforePayment: settings.showDoctorNameBeforePayment,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
