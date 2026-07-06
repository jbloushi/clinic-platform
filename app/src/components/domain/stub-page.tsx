import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/domain/page-header';
import { EmptyState } from '@/components/domain/states';

/**
 * Reusable stub for Phase-3 pages linked from the sidebar. Keeps navigation
 * working without pretending features are complete.
 */
export function StubPage({
  title,
  description,
  detail,
}: {
  title: string;
  description?: string;
  detail?: string;
}) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <Card>
        <CardContent className="p-0">
          <EmptyState
            title="Coming soon"
            description={
              detail ??
              'This screen is planned for a later phase. The core interactive flows are the priority for the demo.'
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
